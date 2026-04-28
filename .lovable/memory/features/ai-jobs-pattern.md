---
name: AI Jobs Async Pattern
description: Padrão único para toda function que chama Gemini — start-* + ai_jobs + worker em waitUntil + polling get-ai-job-status. Imune a timeouts Kong/Cloudflare/Nginx.
type: feature
---

# Padrão de jobs assíncronos para IA (NUNCA síncrono)

Toda function que chama Gemini DEVE seguir este padrão. Síncrono = bug.

## Componentes

- **Tabela `ai_jobs`**: `id, user_id, job_type, status (pending|processing|done|failed), input_payload, result, error_message, started_at, completed_at`
- **Helper `_shared/ai-job-runner.ts`**: `enqueueJob`, `runInBackground`, `JobError`, `corsHeaders`, `jsonResponse`
- **Functions start-***: `start-tools-job`, `start-script-job`, `start-daily-guide-job`, `start-transcription-job` — respondem `{jobId}` em <2s
- **Function única `get-ai-job-status?jobId=...`**: polling do frontend a cada 2s
- **Hook `useAiJob<T>(type)`** + helper inline `runAiJob(fn, payload)` em `Tools.tsx`/`ScriptGenerator.tsx`/`DailyGuide.tsx`

## Por quê

Self-hosted tem Kong=60s + Cloudflare=100s. Qualquer request HTTP > 60s morre cortado, INDEPENDENTE de quão bom esteja o código. No Lovable Cloud "funciona" porque o gateway gerenciado segura 150s+. A solução só é definitiva se o request HTTP nunca passar de 2s — o resto roda em background via `EdgeRuntime.waitUntil()`.

## Quando criar nova function de IA

1. Criar `start-<feature>-job/index.ts` usando `enqueueJob` + `runInBackground`
2. Adicionar `'<feature>'` ao CHECK constraint de `ai_jobs.job_type` (migration + SQL manual no Studio self-hosted)
3. Frontend usa `useAiJob('<feature>')` ou `runAiJob('start-<feature>-job', payload)`
4. NUNCA chamar Gemini direto do request handler — sempre via worker

## Antipatterns proibidos

- ❌ `await callGeminiNative(...)` direto no `serve()` handler — request HTTP segura processo longo
- ❌ Aumentar `proxy_read_timeout` do Kong — paliativo, Cloudflare ainda corta em 100s
- ❌ Frontend com `setTimeout` de timeout próprio — quem controla é o `MAX_POLL_MS` (5min) no hook
