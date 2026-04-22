---
name: Self-hosted Timeout Survival Guide
description: Playbook de diagnóstico quando edge functions falham no self-hosted (api.influlab.pro). Cobre por que migrar do Lovable Cloud gerou timeouts em cascata, como diferenciar erro real de Gemini vs timeout de gateway Kong/Cloudflare/Nginx, sintomas e fórmulas de normalização passo a passo
type: reference
---

# Self-hosted Timeout Survival Guide

Use este arquivo SEMPRE que aparecer "edge function falhando sem motivo aparente" (503/502/504, timeout, login não funciona, geração de tarefa morre, onboarding trava). É o playbook que economiza horas de debug.

## 1. Lição central (não esquecer)

O problema que nos custou dias **NÃO era o Gemini instável**. Era **timeout em camadas do self-hosted** matando a conexão antes do upstream responder:

```
Cliente → Cloudflare (100s) → Nginx VPS → Kong (60s default) → Edge Runtime → Gemini
```

Quando qualquer camada corta a conexão upstream, o erro chega no frontend como 503/502/504 e PARECE "API instável". Mas a function nem terminou — quem matou foi a infra.

**Regra de ouro:** antes de culpar o Gemini, confirmar se a function realmente respondeu (logs `function_edge_logs.execution_time_ms`) ou se foi cortada por timeout de gateway.

## 2. Comparativo: Lovable Cloud (antes) vs Supabase Self-hosted (hoje)

| Aspecto | Lovable Cloud | Self-hosted api.influlab.pro |
|---|---|---|
| Edge runtime timeout | 150s gerenciado | 60s default Kong + 100s Cloudflare proxy |
| Healthcheck do gateway | Gerenciado, invisível | `kong health` com `start_period: 0s` por default → cadeia toda quebra no boot |
| Secrets em functions | UI Lovable, hot reload | Edit `.env` + `docker-compose.yml` `environment:` + `docker compose up -d --force-recreate functions` |
| Recuperação após reboot da VPS | Automática | Manual se algum container falha healthcheck |
| Logs de function | Painel Lovable em tempo real | `docker logs supabase-edge-functions` + `supabase--analytics_query` |
| Deploy de function | Automático no push do GitHub | `./scripts/deploy-selfhost.sh` na VPS (modo Docker) ou CLI |
| Migrations Lovable | Aplicam no banco gerenciado | **NÃO chegam ao self-hosted** — SQL manual no Studio self-hosted |
| Custom domain auth | Gerenciado | GoTrue + Kong + Cloudflare configurados manualmente |
| Email templates | UI Lovable | Bucket `emails/emails/` no Storage + `MAILER_TEMPLATES_*` no GoTrue |

## 3. Por que migrar gerou os problemas

1. **Requests síncronos longos batiam em timeout invisível.** Onboarding original chamava 4 functions em sequência de ~60-90s total dentro de 1 request HTTP. Kong cortava aos 60s, frontend mostrava "503". Solução: refatorar pra **job assíncrono** (`start-onboarding-run` + polling em `onboarding_runs` — ver `mem://features/onboarding-async-jobs`).

2. **Healthcheck do Kong sem `start_period` quebra cadeia no boot.** Container `functions` tem `depends_on: kong: condition: service_healthy`. Se Kong demora >5s pra ficar healthy (e demora ~30s na primeira subida), `functions` recusa subir. Após qualquer reboot da VPS, app inteiro fica fora do ar até intervenção manual.

3. **Erros de timeout mascaravam-se como erros de upstream.** Quando Kong/Cloudflare cortam a conexão, a function pode até estar rodando, mas o cliente recebe 503/502 com payload genérico. Lemos "503" e assumimos "Gemini caiu" — quando na real era nossa infra cortando.

4. **Sem visibilidade automática de logs.** No Lovable Cloud, painel mostra erro na hora. No self-hosted, precisamos abrir `docker logs` ou rodar `supabase--analytics_query` em `function_edge_logs` pra entender se a function executou ou não.

## 4. Sintomas vs causa real (tabela diagnóstica)

| Sintoma no app | Causa provável | Confirmação rápida |
|---|---|---|
| 502 em `/functions/v1/*` | Container `functions` down ou crashou | `docker compose ps functions` — se não tiver `Up (healthy)`, é isso |
| 503 após exatamente ~15-30s | Timeout intermediário (Kong upstream_read_timeout) | Header `x-kong-proxy-latency` ≈ tempo do corte |
| 504 após ~60s | Function rodando >60s síncrono | `function_edge_logs.execution_time_ms` ≥ 60000 ou ausente |
| 503 com `event_message` real do Gemini | API Gemini realmente devolveu erro | `supabase--edge_function_logs` mostra "Gemini 503/429" no corpo |
| Login falhando, todos endpoints 502 | Kong unhealthy, nada roteia | `curl -i https://api.influlab.pro/auth/v1/health` |
| Erro só DEPOIS da VPS reiniciar | Healthcheck sem `start_period` derrubou cadeia | `docker compose ps` mostra `functions` em `Restarting` ou `Exited` |
| Function nova não responde | Não foi deployada no volume | `curl -sI -X OPTIONS .../<fn>` sem header `x-influlab-function-version` |
| Function com secret novo dá erro de env | `.env` editado mas `environment:` do compose esquecido | `docker exec supabase-edge-functions env \| grep NOME_SECRET` |

## 5. Fórmulas de normalização (em ordem — siga sequencialmente)

### Passo 1 — Triagem de 30 segundos
```bash
cd /root/supabase/docker
docker compose ps
curl -i https://api.influlab.pro/auth/v1/health -H "apikey: $ANON_KEY"
curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run | grep -iE 'http|x-influlab'
```
Se tudo retorna `Up (healthy)` + 200 + header `x-influlab-function-version` presente → infra OK, problema é específico de uma function.

### Passo 2 — Algum container down/unhealthy
```bash
docker compose up -d --no-deps <nome-do-service>
docker logs <container> --tail 50
```
Se `kong` unhealthy persistente → confirmar `start_period: 60s` no healthcheck (ver `MIGRATION-FUNCTIONS.md` §6).

### Passo 3 — YAML quebrado depois de edição
```bash
docker compose config -q
# Se erro: restaurar backup
cp docker-compose.yml.bak docker-compose.yml
docker compose config -q && echo OK
```
Sempre fazer `cp docker-compose.yml docker-compose.yml.bak` ANTES de editar.

### Passo 4 — Functions desatualizadas (frontend mudou, backend não)
```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```
O script valida YAML, copia `_shared` + functions pro volume, restarta `functions`, valida headers de versão.

### Passo 5 — Diagnóstico fino: Gemini real vs timeout de gateway
Rodar (via tool, não bash):
- `supabase--edge_function_logs({function_name: "generate-daily-guide"})` → vê o erro que a function logou (se é Gemini ou outro)
- `supabase--analytics_query({query: "select id, timestamp, response.status_code, m.execution_time_ms from function_edge_logs cross join unnest(metadata) as m cross join unnest(m.response) as response where m.function_id = '...' order by timestamp desc limit 20"})` → vê tempo real de execução

**Diferenciação chave:**
- `execution_time_ms` ≈ 15000-30000 + status 503 sem log de erro da function = **timeout do Kong/Cloudflare** (infra)
- `execution_time_ms` < 5000 + status 503 + log "Gemini retornou 503" = **Gemini real** (upstream)
- Sem entrada em `function_edge_logs` = function nem foi acionada (Kong cortou antes)

### Passo 6 — Secret faltando ou desatualizado
```bash
docker exec supabase-edge-functions env | grep -i <NOME_SECRET>
```
Se vazio → editar `~/supabase/docker/.env` E adicionar `NOME_SECRET: ${NOME_SECRET}` no `environment:` do service `functions` E `docker compose up -d --force-recreate functions`. Os 3 passos são obrigatórios.

## 6. Regras pra prevenir recorrência

- **Toda function que PODE passar de 30s** → padrão job assíncrono (`start-onboarding-run` + tabela de runs + polling). Nunca segurar request HTTP longo.
- **Todo healthcheck com `depends_on: service_healthy`** → exigir `start_period >= 60s`. Sem isso, qualquer reboot é roleta russa.
- **Toda mudança de secret** → `.env` + `environment:` do compose + `--force-recreate`. Anotar no commit.
- **Backup do compose ANTES de qualquer edit:** `cp docker-compose.yml docker-compose.yml.bak`. Sempre.
- **Toda function nova tem que setar `x-influlab-function-version` no response header** — é como o `deploy-selfhost.sh` valida que o deploy chegou.
- **Retry com backoff em chamadas Gemini** (`_shared/gemini.ts` + retry no caller) pra absorver 503 transitório sem propagar pro usuário, e cota só consumida em sucesso.

## 7. O que NÃO assumir mais

- ❌ "503 = Gemini instável" — no self-hosted, na maioria das vezes é timeout de gateway. Confirmar com `function_edge_logs.execution_time_ms` ANTES de culpar Google.
- ❌ "Funcionou ontem, vai funcionar hoje" — reboot da VPS sem `start_period` quebra cadeia silenciosamente.
- ❌ "Migration Lovable vai resolver no banco" — Lovable migra o banco gerenciado dela, não o self-hosted. SQL sempre manual no Studio self-hosted.
- ❌ "É bug do código" sem antes ver `docker compose ps` e `docker logs supabase-edge-functions --tail 100`.
- ❌ "Vou só editar o `.env`" — sem espelhar em `environment:` do compose, secret não chega no container.

## 8. Comandos de emergência (cola e roda)

```bash
# Snapshot completo do estado da infra em 1 comando
cd /root/supabase/docker && docker compose ps && \
  echo "--- functions logs ---" && docker logs supabase-edge-functions --tail 30 && \
  echo "--- kong logs ---" && docker logs supabase-kong --tail 20 && \
  echo "--- auth health ---" && curl -sI https://api.influlab.pro/auth/v1/health
```

Cola o output desse bloco no chat → diagnóstico em 1 turno.
