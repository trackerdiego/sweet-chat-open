---
name: Onboarding Async Jobs
description: Onboarding usa job assíncrono em background (EdgeRuntime.waitUntil) com tabela onboarding_runs e polling, para evitar timeouts de Kong/Nginx no self-hosted
type: feature
---

O onboarding NÃO chama mais `generate-audience-profile` ou `generate-personalized-matrix` direto do frontend. O fluxo é:

1. Frontend → `start-onboarding-run` → cria row em `public.onboarding_runs`, dispara worker via `EdgeRuntime.waitUntil`, retorna `{ runId }` em <1s.
2. Worker em background processa 4 etapas sequenciais, atualizando `onboarding_runs.stages` a cada passo: `profile` → `audience` → `visceral` → `matrix`.
3. Frontend → `get-onboarding-run-status?runId=...` a cada 2s (polling). Pinta verde os cards conforme `stages[].status === 'done'`.
4. `onboarding_completed = true` só após `user_strategies` salvo com >= 28 itens E `matrixValidated = true` no status endpoint.
5. Hook `useOnboardingRun` salva runId em localStorage (`influlab.onboardingRunId`) — refresh retoma o polling.

Por que: Kong/Nginx do self-hosted matam requests >60s. Como nenhuma request HTTP do onboarding dura mais que ~2s, ninguém tem o que matar.

Tabela `onboarding_runs`: id, user_id, status (pending|running|completed|failed), current_stage (1..4), stages (jsonb array), input_payload, error_message, completed_at. RLS: usuário lê próprio; service role gerencia.

As funções `generate-audience-profile` e `generate-personalized-matrix` antigas continuam deployadas mas não são mais chamadas pelo onboarding — podem ser removidas no futuro se nenhum outro fluxo as usar.
