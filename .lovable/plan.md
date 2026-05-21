## Hype do Dia — feed personalizado por nicho

Card novo no Dashboard mostrando **Top 5 tendências do dia** já adaptadas ao nicho do usuário, com gancho pronto e botão "Gerar roteiro disso" que reaproveita o `generate-script` existente.

### Arquitetura (segue o padrão obrigatório de jobs assíncronos)

```text
                    ┌──── CRON diário 06:00 BRT ────┐
                    │  fetch-daily-hype (global)    │
                    │  Perplexity sonar + Google    │
                    │  Trends RSS BR → ~30 trends   │
                    │  brutas em daily_hype_raw     │
                    └───────────────┬───────────────┘
                                    │
   user abre Dashboard              ▼
   ┌─────────────────┐    ┌──────────────────────────┐
   │ HypeOfTheDay.tsx│───▶│ start-hype-job (user)    │
   │ useAiJob('hype')│    │ lê audience_profile      │
   └────────┬────────┘    │ + daily_hype_raw do dia  │
            │             │ Gemini reranqueia +      │
            │ polling 2s  │ adapta top 5 com gancho  │
            │             │ grava user_daily_hype    │
            │             └──────────────────────────┘
            ▼
   5 cards: tema · porque tá bombando · gancho pronto · [Gerar roteiro]
```

Dois estágios separados pra economizar: scraping global roda **1x por dia** (não 1x por user); só a curadoria Gemini é por user, e fica cacheada 24h em `user_daily_hype` (segunda abertura no mesmo dia = 0 custo).

### Dados (SQL pro Studio self-hosted)

- `daily_hype_raw` — `id, date (date, unique), source ('perplexity'|'gtrends'), trends jsonb, created_at`. Uma linha por fonte por dia.
- `user_daily_hype` — `id, user_id, date, items jsonb (5 cards), created_at`. UNIQUE(user_id, date). RLS: user só lê o próprio.
- Adicionar `'hype'` no CHECK constraint de `ai_jobs.job_type`.

### Edge functions novas

1. **`fetch-daily-hype`** (cron, sem JWT) — chama Perplexity `sonar` com prompt tipo "tendências, memes e assuntos em alta no Brasil hoje em redes sociais e cultura pop, com fontes" + parser do RSS público do Google Trends BR. Grava bruto em `daily_hype_raw`. ~30s, roda fora do caminho crítico do user.
2. **`start-hype-job`** — segue 100% o padrão `ai-job-runner`: enfileira em `ai_jobs`, responde `{jobId}` em <2s, worker em `EdgeRuntime.waitUntil` chama Gemini com perfil do user + raw do dia → 5 itens estruturados `{tema, porque_bombou, gancho, formato_sugerido, fontes[]}`. Grava em `user_daily_hype` e marca job done.
3. **`get-ai-job-status`** já existe, só consumir.

Antes de chamar Gemini, checar `user_daily_hype` do dia — se existir, retorna direto sem criar job.

### Frontend

- `src/components/HypeOfTheDay.tsx` — card glass entre `MindsetPulse` e `MonthlyProgress` em `Index.tsx`. Skeleton enquanto job roda. Cada item abre um sheet com detalhes e CTA "Gerar roteiro disso" que pré-preenche o `ScriptGenerator` com o gancho.
- `src/hooks/useDailyHype.ts` — wrapper sobre `useAiJob('hype')` que dispara só 1x por dia (chave `hype-${userId}-${YYYY-MM-DD}` em localStorage pra evitar polling repetido).
- Premium-only: gated por `useSubscription` (free vê preview borrado com CTA assinar, igual padrão do app).

### Custos & limites

- Perplexity sonar: 1 call/dia global ≈ centavos.
- Gemini Flash: 1 call/user/dia, ~2k tokens entrada + 1k saída. Em 1000 users ativos/dia = barato.
- Cache de 24h em `user_daily_hype` evita reprocessar.

### Segredos necessários

- `PERPLEXITY_API_KEY` via connector Perplexity (gateway). Confirmar que self-hosted aceita o gateway ou usar API direta com `add_secret` (mais simples no self-hosted). **Recomendo direto**: `add_secret(PERPLEXITY_API_KEY)` + injetar no `docker-compose.yml` do functions.

### Cron

```sql
select cron.schedule('fetch-daily-hype', '0 9 * * *', $$
  select net.http_post(
    url:='https://api.influlab.pro/functions/v1/fetch-daily-hype',
    headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb
  );
$$);
```
(09:00 UTC = 06:00 BRT — antes do user acordar)

### Entrega

Cada resposta minha de implementação termina com bloco copy-paste pra rodar na VPS (SQL no Studio + `./scripts/deploy-selfhost.sh fetch-daily-hype start-hype-job` + `docker compose up -d --force-recreate functions` se mexer em secret).

### Out of scope (pra confirmar depois)

- Push notification "seu hype do dia chegou" — fácil de adicionar depois usando `send-push` já existente.
- TikTok/IG real — exigiria OAuth por user, fica pra v2.
- Histórico dos hypes passados — só se você quiser, hoje fica só o do dia.