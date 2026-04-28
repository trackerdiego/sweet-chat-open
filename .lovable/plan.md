

# Plano definitivo: matar o problema de timeout — sem paliativo

## Por que no Lovable Cloud "funcionava lindo"

Não é mágica. É infraestrutura diferente, e a diferença explica TUDO:

| Camada | Lovable Cloud | Sua VPS self-hosted |
|---|---|---|
| Edge runtime | **150s** de timeout gerenciado pela Supabase | 60s (limite Kong) |
| Gateway upstream | Configurado pra workloads de IA | Kong default `proxy_read_timeout` ~60s |
| Proxy externo | Sem Cloudflare na frente | Cloudflare proxy: corte hard em **100s** |
| Healthcheck do gateway | Gerenciado, invisível | `start_period` que a gente teve que corrigir manual |
| Retry em 503 transitório | Camada gerenciada absorve | Tudo cai no usuário |

**Resumo brutal:** no Lovable Cloud, uma function de IA podia rodar 90s porque a infra deixava. Na sua VPS, qualquer coisa >60s **morre cortada pelo Kong** — não importa quão bem o código esteja escrito. O que você sentiu na reunião não foi código bugado, foi a infra cortando conexão no meio.

## Por que aumentar o timeout do Kong é paliativo (e por que vou recusar)

A tentação óbvia é: "muda o Kong pra 300s e pronto". **NÃO.** Razões:

1. Cloudflare na frente corta em 100s independente do que Kong faça — pra passar disso precisaria desligar proxy do CF, perdendo DDoS protection
2. Request HTTP segurando 5min é antipattern — qualquer instabilidade de rede do usuário (mobile trocando de torre, WiFi caindo) mata tudo
3. Edge runtime do Supabase tem limite próprio de execução por request — mesmo com Kong em 300s, o runtime pode encerrar
4. Recurso ocupado: 1 worker do Kong fica preso 5min/usuário — escalar pra 100 usuários simultâneos = Kong morre
5. **Você ainda dependeria do Gemini responder em <5min** — Gemini eventualmente passa disso e você volta ao mesmo problema

## A solução profissional (a única correta): job queue assíncrono

Esse é o padrão que **toda app séria** com workload de IA usa: OpenAI Playground, Midjourney, Runway, ElevenLabs — todos. Request HTTP **nunca** segura processamento de IA. Você já tem isso funcionando perfeitamente no onboarding (`start-onboarding-run` + `onboarding_runs` + polling). É só replicar pras outras 4 funções.

### Arquitetura

```text
┌─────────┐  POST       ┌──────────────────┐
│Frontend │ ──────────> │ start-ai-job     │ (responde em <2s)
│         │             │ - valida JWT     │
│         │ <────────── │ - cria row em    │
│         │  {jobId}    │   ai_jobs        │
│         │             │ - dispara worker │
└─────────┘             │   via            │
     │                  │   waitUntil()    │
     │                  └────────┬─────────┘
     │                           │ (em background, sem prazo)
     │                           ▼
     │                  ┌──────────────────┐
     │                  │ Gemini API       │
     │                  │ (pode levar 60s, │
     │                  │  120s, 180s...)  │
     │                  └────────┬─────────┘
     │                           │
     │                           ▼
     │                  ┌──────────────────┐
     │                  │ UPDATE ai_jobs   │
     │                  │ status='done'    │
     │                  │ result=<json>    │
     │                  └──────────────────┘
     │
     │ GET /get-ai-job-status?id=...    (polling 2s OU realtime)
     │ ──────────────────────────>
     │ <────────────────────────── { status: 'processing' }
     │ ──────────────────────────>
     │ <────────────────────────── { status: 'done', result: {...} }
```

**Vantagens reais:**
- Request HTTP dura <2s sempre → Kong, Cloudflare, Nginx nunca cortam, mesmo se Gemini levar 5 minutos
- Funciona com mobile trocando de rede (job continua processando, app retoma quando voltar)
- Retry/erros transitórios do Gemini ficam isolados no worker, sem propagar pro usuário no meio
- Escala: Kong libera worker em 2s, aguenta 100x mais carga simultânea
- Auditável: cada job vira row com `started_at`, `completed_at`, `error`, dá pra investigar tudo
- Premium UX: mostra progresso real, não spinner mudo

## Implementação concreta

### 1. Tabela única `ai_jobs` (1 migration SQL)

```sql
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_type text not null,          -- 'tools' | 'script' | 'daily_guide' | 'transcription'
  status text not null default 'pending',  -- pending|processing|done|failed
  input_payload jsonb not null,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.ai_jobs enable row level security;
create policy "users read own jobs" on public.ai_jobs
  for select using (auth.uid() = user_id);
create index ai_jobs_user_status_idx on public.ai_jobs (user_id, status, created_at desc);
```

(Você roda esse SQL no Studio self-hosted — memorizado em `mem://infra/backend-selfhosted`.)

### 2. Refatorar 4 functions pro padrão start/worker

| Function antiga (síncrona) | Vira | Worker |
|---|---|---|
| `generate-tools-content` | `start-tools-job` (responde jobId) | mesmo arquivo, processamento dentro de `EdgeRuntime.waitUntil()` |
| `generate-script` | `start-script-job` | idem |
| `generate-daily-guide` | `start-daily-guide-job` | idem |
| `transcribe-media` | `start-transcription-job` | idem |

E **uma única** function de status: `get-ai-job-status?id=...` que serve as 4.

Mantenho compatibilidade temporária: as functions antigas continuam respondendo no path antigo, mas internamente já fazem a coisa certa (job + redirect).

### 3. Frontend — hook genérico `useAiJob`

Cria `src/hooks/useAiJob.ts` (idêntico em padrão ao `useOnboardingRun`):
- `startJob(type, payload)` → dispara, retorna jobId, salva no localStorage
- `pollStatus(jobId)` a cada 2s
- `cancel()`, `retry()`
- Estado: `idle | starting | processing | done | failed`

Aplicar nos 4 componentes que hoje fazem `supabase.functions.invoke` síncrono:
- `src/pages/Tools.tsx` (4 ferramentas + transcrição)
- `src/components/ScriptGenerator.tsx`
- `src/components/DailyGuide.tsx`

UX: enquanto `processing`, mostra estado claro ("Gerando ganchos... isso leva 10-30s") com cancelar opcional. Toast amigável em `failed` com botão de retry que reusa o mesmo input.

### 4. Limpeza automática

Cron simples (edge function `cleanup-old-jobs` chamada por `pg_cron` ou disparada manualmente): delete jobs com `created_at < now() - 7 days`. Sem isso a tabela infla.

## O que muda concretamente no repo

**Backend (criar):**
- `supabase/migrations/<ts>_create_ai_jobs.sql`
- `supabase/functions/start-tools-job/index.ts`
- `supabase/functions/start-script-job/index.ts`
- `supabase/functions/start-daily-guide-job/index.ts`
- `supabase/functions/start-transcription-job/index.ts`
- `supabase/functions/get-ai-job-status/index.ts`
- `supabase/functions/_shared/ai-job-runner.ts` (helper compartilhado: `enqueue`, `markProcessing`, `markDone`, `markFailed`, `runInBackground`)

**Backend (apagar/desativar — após migração validada):**
- versões síncronas antigas de `generate-tools-content`, `generate-script`, `generate-daily-guide`, `transcribe-media`

**Frontend (criar):**
- `src/hooks/useAiJob.ts`

**Frontend (modificar):**
- `src/pages/Tools.tsx` — trocar invoke direto por `useAiJob`
- `src/components/ScriptGenerator.tsx` — idem
- `src/components/DailyGuide.tsx` — idem

**Memória (atualizar):**
- `mem://index.md` — adicionar Core rule: "Toda function que chama Gemini → padrão job assíncrono. Síncrono = bug. Padrão único: ai_jobs + worker em waitUntil + polling get-ai-job-status."
- Criar `mem://features/ai-jobs-pattern.md` com o padrão

## Bloco final pra rodar na VPS

Como sempre — código sobe via Lovable→GitHub, e na VPS:

```bash
cd /root/app && git pull
./scripts/deploy-selfhost.sh \
  start-tools-job start-script-job start-daily-guide-job \
  start-transcription-job get-ai-job-status
```

E o SQL de criação da `ai_jobs` cola no SQL Editor do Studio self-hosted (https://api.influlab.pro).

## O que NÃO vou tocar

- **Onboarding** — já está nesse padrão, não mexo
- **`ai-chat`** — é streaming SSE, padrão diferente, funciona bem hoje
- **Kong / Cloudflare / Nginx config** — não preciso aumentar timeout de nada, justamente porque nenhum request vai passar de 2s
- **Função `_shared/gemini.ts`** — continua igual, só passa a ser chamada de dentro do worker em vez do request handler

## Riscos e trade-offs honestos

1. **Trabalho de migração:** ~1 turno cheio (5 functions novas + 1 hook + 3 componentes + migration + memórias). Não é pequeno. Mas é único — depois nunca mais volta esse problema.
2. **UX muda sutilmente:** usuário vê "Gerando..." aparecer rápido em vez de spinner travado. Isso é **melhor** — feedback ativo > silêncio. Mostro progresso/tempo decorrido.
3. **Tabela `ai_jobs` cresce:** mitigado pelo cleanup de 7 dias. Volume real estimado: 100 usuários × 10 jobs/dia × 7 dias = 7k rows. Trivial.
4. **Custo:** zero. Mesma chamada Gemini, mesmo custo. Só muda quem segura o request HTTP no meio.

## Por que essa é a solução final

- Resolve a **causa-raiz** (request HTTP segurando processo longo), não o sintoma (timeout específico)
- É o padrão que **toda app de IA séria** usa (OpenAI, Anthropic, Replicate, Runway)
- **Imune** a qualquer mudança futura de Kong/Cloudflare/Nginx — o request nunca passa de 2s
- Já está validado no seu próprio app (onboarding usa há semanas, sem 1 reclamação)
- **Escala** pro lançamento: Kong libera workers rápido, aguenta picos
- **Audit trail** completo na tabela `ai_jobs` — debug de qualquer falha em 1 query

Aprova esse plano? Se sim, executo end-to-end no próximo turno.

