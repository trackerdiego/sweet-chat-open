

# Plano: resolver o timeout do Kong/Nginx no self-hosted via arquitetura assíncrona (job queue)

## Diagnóstico correto

Você acertou. O problema **não é o Gemini** e nem o código das Edge Functions. É infra:

```text
Browser → Nginx (api.influlab.pro) → Kong → Edge Runtime → Gemini
                  ↑          ↑
              timeout     timeout
              padrão      padrão
              60s         60s
```

No Lovable Cloud, o gateway tolera requests longas (até ~150s) porque está tunado para isso. No self-hosted padrão:

- **Nginx**: `proxy_read_timeout` default = 60s
- **Kong**: `read_timeout` / `write_timeout` default = 60s
- **Edge Runtime (Deno)**: `worker_timeout_ms` default = 150s, mas o Kong/Nginx mata antes

A geração da matriz (4 chamadas Gemini sequenciais/paralelas + parsing + upsert) tranquilamente passa de 60s. Resultado: **504 Gateway Timeout** vindo do Nginx ou Kong, mesmo com a função ainda processando por trás. Por isso “tudo verdinho no Lovable, falha no self-hosted”.

Aumentar timeout do Nginx/Kong é paliativo (funciona, mas usuário fica olhando spinner 90s e qualquer instabilidade quebra de novo). A solução definitiva é **parar de segurar a request HTTP aberta** durante a geração.

## Solução: arquitetura de job assíncrono

Em vez de o frontend chamar uma função e esperar ela terminar:

```text
ANTES (quebra no self-hosted):
  POST /generate-personalized-matrix
  ← espera 60-120s ←
  504 Gateway Timeout

DEPOIS (imune a timeout de proxy):
  POST /start-onboarding-run        → retorna em <1s com runId
  GET  /get-onboarding-run-status   → polling a cada 2s, sempre <1s
  (processamento real roda em background, fora do ciclo de request HTTP)
```

A request HTTP nunca dura mais que 1-2s. Kong, Nginx, Cloudflare — ninguém tem o que matar.

## 4 etapas reais (volta ao que funcionava)

```text
1. Preparando seu perfil          (instantâneo — só salva form)
2. Analisando seu público         (Gemini ~10s, em background)
3. Construindo estudo visceral    (Gemini ~15s, em background)
4. Montando sua matriz de 30 dias (Gemini ~30s, em background)
```

Cada etapa atualiza `onboarding_runs.stages` no banco. O frontend pinta verde conforme o status muda no polling.

## Arquitetura técnica

### Nova tabela (SQL manual no self-hosted)

```sql
create table public.onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending',           -- pending | running | completed | failed
  current_stage int not null default 1,             -- 1..4
  stages jsonb not null default '[]'::jsonb,        -- [{stage, status, started_at, finished_at, error}]
  input_payload jsonb not null default '{}'::jsonb, -- displayName, primaryNiche, contentStyle, etc
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.onboarding_runs enable row level security;

create policy "users read own runs" on public.onboarding_runs
  for select to authenticated using (auth.uid() = user_id);

create policy "service role manages runs" on public.onboarding_runs
  for all to service_role using (true) with check (true);

create index on public.onboarding_runs (user_id, created_at desc);
create index on public.onboarding_runs (status) where status in ('pending','running');
```

### Novas Edge Functions

**`start-onboarding-run`** (rápida, retorna em <1s):
- valida JWT
- cria row em `onboarding_runs` com input_payload
- dispara processamento em background com `EdgeRuntime.waitUntil(...)` — Deno permite continuar executando após o response sair
- retorna `{ runId }` imediatamente
- o background worker chama as 4 etapas em sequência, atualizando `stages` no banco

**`get-onboarding-run-status`** (rápida, retorna em <1s):
- valida JWT
- lê `onboarding_runs` por id
- retorna `{ status, current_stage, stages, error_message }`

### Por que `EdgeRuntime.waitUntil` resolve

```typescript
serve(async (req) => {
  const { runId } = await criarRun();
  
  // Dispara em background — response volta AGORA
  EdgeRuntime.waitUntil(processarTodasEtapas(runId));
  
  return Response.json({ runId }); // ← Kong/Nginx vê resposta em 200ms
});
```

`EdgeRuntime.waitUntil` mantém o worker vivo até o background terminar (até `worker_timeout_ms`, default 150s — suficiente). Mas a **conexão HTTP fecha imediatamente**, então Kong/Nginx não têm o que matar.

### Funções existentes viram helpers internos

`generate-audience-profile` e `generate-personalized-matrix` deixam de ser endpoints chamados pelo frontend. Viram módulos importados pelo background worker do `start-onboarding-run`. Mantém toda a lógica atual de fallback local, service role, prompts viscerais — só muda quem chama.

### Frontend (Onboarding.tsx)

```text
1. Submit do form → chama start-onboarding-run → recebe runId, salva em estado
2. setInterval(2000) chama get-onboarding-run-status
3. Atualiza visual dos 4 cards conforme stages mudam
4. Quando status === 'completed' E matriz validada (>= 28 dias) → redireciona para /
5. Se status === 'failed' → mostra erro real da etapa que falhou + botão "Tentar de novo"
6. Se usuário fecha aba e reabre → busca run em andamento e retoma o polling
```

Isso elimina:
- 504 do proxy
- “Não foi possível gerar, tente novamente” como UX padrão
- perda de progresso ao dar refresh
- usuário pagar e ficar travado no primeiro uso

## Arquivos alterados

### Edge Functions
- **NOVO** `supabase/functions/start-onboarding-run/index.ts` — cria run, dispara background, retorna runId
- **NOVO** `supabase/functions/get-onboarding-run-status/index.ts` — polling de status
- `supabase/functions/generate-audience-profile/index.ts` — refatorado para exportar helpers reutilizáveis (ou inlinado no worker)
- `supabase/functions/generate-personalized-matrix/index.ts` — idem

### Frontend
- `src/pages/Onboarding.tsx` — troca chamadas síncronas por start + polling, 4 cards reais
- **NOVO** `src/hooks/useOnboardingRun.ts` — encapsula lógica de polling, retomada e validação final

### Banco
- SQL manual para o self-hosted criar `onboarding_runs` + policies + índices
- SQL de reset do `cakerollguide@gmail.com` para reteste limpo

### Hooks existentes (intactos)
- `useUserProfile.ts` — mantém trava de integridade
- `useUserStrategies.ts` — sem mudanças
- `App.tsx` — sem mudanças

## Sobre Kong/Nginx (opcional, mas recomendado)

Mesmo com a arquitetura assíncrona, vale subir os timeouts do proxy de 60s → 180s como cinto de segurança. Vou te entregar no final um snippet de `nginx.conf` e `kong.yml` opcional, **mas a app funciona sem isso** porque nenhuma request vai mais durar tanto.

## Deploy

Edge Functions novas + alteradas → exige sync da VPS:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

E o SQL da `onboarding_runs` rodado uma vez no Studio self-hosted **antes** do deploy.

## Resultado esperado

- Nenhuma request HTTP do onboarding dura mais que ~2s
- Kong/Nginx nunca mais devolvem 504 nesse fluxo
- Os 4 cards pintam de verde conforme cada etapa termina, com progresso real do banco
- Refresh no meio do onboarding retoma do ponto onde estava
- `onboarding_completed=true` só após matriz validada
- Primeira impressão de usuário pagante deixa de ser “erro, tente de novo”

