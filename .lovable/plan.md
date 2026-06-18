
# Análise do incidente de push notifications

## O que o código garante hoje (`scheduled-push` + `send-push`)

- Dedup por usuário/dia/bloco existe via tabela `push_send_log` (user_id, send_date, block).
- Há 4 blocos no dia: `morning` (<11h), `insight` (11-15h), `afternoon` (15-19h), `evening` (≥19h), horário BR.
- Dedup **só é gravada se `delivered > 0`**. Se a tentativa retornar 0 entregues, o próximo cron tenta de novo.
- `send-push` itera **todas** as subscriptions do usuário (cada device/browser conta como 1 envio).
- Subscription que devolve 404/410 é apagada.

## Hipóteses do que aconteceu

**1) Rajada de pushes a cada ~5 min num único dia**
Causa mais provável: o cron do pg_cron foi agendado com intervalo curto (ex.: `*/5 * * * *`) e, naquele dia, **a tabela `push_send_log` ainda não existia / não tinha índice único / a inserção falhava silenciosamente**. Como o dedup só grava quando `delivered>0`, qualquer falha no insert do log faz o próximo tick reenviar.

Causas alternativas:
- Múltiplas subscriptions ativas pro mesmo user (PWA instalado + browser desktop + abas) — `sent` vira N por execução.
- Cron disparando com `body.block` variando (ou sem block), trocando de bloco conforme a hora — cada bloco novo é uma janela de dedup nova.

**2) Silêncio total depois do 1º dia**
Causas candidatas, em ordem:
- O job no `cron.job` foi **pausado/desativado** (active=false) ou removido após o susto.
- Todas as `push_subscriptions` retornaram 410 (expired) e foram **deletadas** pelo handler de `send-push` → `subs` fica vazio → "No subscribers" silencioso.
- VAPID keys mudaram entre deploys (as keys hoje são **hardcoded** em `send-push/index.ts`). Se o SW no device foi registrado com outra `applicationServerKey`, todo envio retorna 403/410 e zera tudo.
- Service worker do PWA foi atualizado/renomeado (cache busting), invalidando a subscription antiga.

## Plano de diagnóstico

Vou te entregar SQLs prontos pra rodar no Studio self-hosted (`https://api.influlab.pro` → SQL Editor). Cada bloco confirma/derruba uma hipótese. **Não vou alterar nada agora** — só investigar.

### Passo 1 — Estado do cron
```sql
-- todos os jobs de push
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE command ILIKE '%scheduled-push%' OR jobname ILIKE '%push%';

-- últimas execuções (sucesso/erro/duração)
SELECT j.jobname, r.start_time, r.end_time, r.status, r.return_message
FROM cron.job_run_details r
JOIN cron.job j USING (jobid)
WHERE j.command ILIKE '%scheduled-push%'
ORDER BY r.start_time DESC
LIMIT 100;
```
→ Confirma se o cron está **ativo**, qual é o **schedule real** (5min? hora cheia?), e se parou de rodar em alguma data.

### Passo 2 — Histórico real dos disparos
```sql
-- volume por dia / bloco
SELECT send_date, block, COUNT(*) AS users_marked
FROM push_send_log
GROUP BY send_date, block
ORDER BY send_date DESC, block;

-- pico do dia da rajada (substitua a data)
SELECT user_id, block, COUNT(*) AS entries
FROM push_send_log
WHERE send_date = '2026-05-XX'
GROUP BY user_id, block
HAVING COUNT(*) > 1
ORDER BY entries DESC;
```
→ Se aparecer >1 entrada por (user, block, dia), o índice único do dedup nunca existiu. Se a tabela estiver **vazia ou inexistente**, o dedup nunca funcionou.

### Passo 3 — Estado das subscriptions
```sql
SELECT COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS users,
       MIN(created_at) AS oldest,
       MAX(created_at) AS newest
FROM push_subscriptions;

-- usuários com múltiplos devices (explica volume 2x/3x por tick)
SELECT user_id, COUNT(*) AS devices
FROM push_subscriptions
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY devices DESC;
```
→ Se `total=0`, todas foram limpas por 410/404 — explica o silêncio. Se muitos têm 2-3 devices, explica em parte o volume.

### Passo 4 — Logs da edge function (terminal VPS)
```bash
cd ~/supabase/docker
docker compose logs functions --since 720h 2>&1 \
  | grep -E '(scheduled-push|send-push)' \
  | tail -500
```
Procurar por:
- `[scheduled-push] Block: ... Sent: N, Skipped(dedup): M` → mostra se dedup tava funcionando
- `[send-push] ✗ 410` / `404` → subscriptions sendo invalidadas
- `[send-push] ✗ 403` → VAPID key mismatch
- Datas em que parou de aparecer log → quando o cron silenciou

## O que esperar como output

Depois que você rodar e me mandar os resultados (cole as 4 saídas), eu te entrego:
1. Causa confirmada da rajada.
2. Causa confirmada do silêncio.
3. Fix definitivo: ou (a) reagendar cron com intervalo correto + garantir índice único no `push_send_log`, ou (b) reativar cron pausado, ou (c) forçar re-subscribe dos devices se as keys/SW invalidaram tudo.

Sem essas saídas eu só conseguiria chutar — prefiro confirmar antes de mexer em produção.
