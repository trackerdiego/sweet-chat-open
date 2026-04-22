

# Plano: corrigir 503 do `generate-daily-guide` + auditoria pré-lançamento

## O que o print mostra

`POST /functions/v1/generate-daily-guide` → **HTTP 503** após 15s. Isso **não é limite de uso** (limite retornaria 429 com mensagem "Você atingiu o limite de 2 gerações"). 503 nessa função só sai em 1 lugar do código:

```ts
if (e.status === 503) return jsonResponse({ error: "Serviço de IA instável..." }, 503);
```

Ou seja: o **Google Gemini retornou 503** (modelo sobrecarregado / instável) durante a chamada A do guia diário. A função em si está saudável — o upstream (Gemini) que falhou.

## Investigação a fazer (próximo turno em build mode)

1. **Logs reais da função** via `supabase--edge_function_logs` filtrando `generate-daily-guide` para confirmar:
   - É 503 do Gemini mesmo, ou outro erro?
   - Qual modelo foi usado (`gemini-3-flash-preview`? `gemini-2.5-flash`?)
   - Latência da chamada A
2. **Onboarding que funcionou**: pegar logs de `start-onboarding-run` + `get-onboarding-run-status` da última run bem-sucedida pra confirmar que o async job + polling estão saudáveis (memorizar o padrão pra não quebrar de novo)
3. **Status do `user_usage`** do usuário logado — confirmar que `tool_generations < 2` ou `is_premium = true` (descartar 100% a hipótese de limite)

## Correção planejada

### A. Resiliência contra 503 do Gemini (causa raiz do print)

Em `supabase/functions/generate-daily-guide/index.ts`:

1. **Retry com backoff** na chamada A: se Gemini devolver 503, tentar 2x com 2s e 4s de espera antes de devolver erro pro frontend
2. **Fallback de modelo**: se A falhar 3x num modelo, tentar mesma chamada em `gemini-2.5-flash` (mais estável que preview)
3. **Mensagem de erro mais clara no frontend**: `DailyGuide.tsx` precisa diferenciar 429 (limite) de 503 (Gemini instável) — hoje só mostra toast genérico
4. **Não consumir cota** quando der 503 — confirmar no código que o `user_usage.update` só roda no caminho de sucesso (já está, mas validar)

### B. Auditoria pré-lançamento

Checklist objetivo do que validar antes de abrir pra usuários reais:

| Item | Como validar |
|---|---|
| Login + signup sem confirmação de email | Curl + teste manual |
| Onboarding async (4 etapas verdes) | Já validado ✅ |
| Geração de matriz personalizada | Logs `generate-personalized-matrix` |
| `generate-daily-guide` com retry | Após fix acima |
| `generate-script` (3/dia free, ilimitado premium) | Curl autenticado |
| Pagamento Asaas + webhook ativando premium | Logs `asaas-webhook` últimos 7d |
| Push notifications (VAPID) | Teste em dispositivo |
| Single session limit (auto-logout 2 abas) | Teste manual |
| Free tier bloqueando dia 8+ da matriz | Teste com user free |
| Admin (/admin) só pra agentevendeagente@gmail.com | Teste manual |
| Backups do Postgres self-hosted | Verificar `pg_dump` cron na VPS |
| Healthcheck do Kong (`unhealthy` cosmético) | Investigar `start_period` no compose |
| Rate limit do Gemini sob carga | Stress test com 10 usuários simultâneos |

### C. Item de risco real pra lançamento

O **healthcheck `unhealthy` do Kong** que vimos ontem é cosmético HOJE, mas se a VPS reiniciar, o `functions` pode não subir de novo (foi exatamente o que aconteceu). Antes do lançamento precisamos:

- Aumentar `start_period` do healthcheck do Kong no `docker-compose.yml` (de `5s` para `60s`) pra ele ter tempo de ficar healthy
- Ou trocar o healthcheck por um curl ao `/auth/v1/health` interno (mais confiável que `kong health`)

Isso entra como SQL/ajuste manual na VPS no próximo turno.

## O que vai mudar no repo

1. `supabase/functions/generate-daily-guide/index.ts` — retry + fallback de modelo + log estruturado do erro upstream
2. `src/components/DailyGuide.tsx` — toast diferenciado pra 429 vs 503 vs 500
3. `supabase/functions/generate-script/index.ts` — mesmo retry pattern (preventivo, mesma raiz)
4. `MIGRATION-FUNCTIONS.md` — adicionar nota sobre `start_period` do Kong no self-hosted

## O que NÃO vai mudar

- Lógica de limite de uso (`user_usage`) — está correta, não é a causa
- Schema do banco — nenhum SQL novo
- Onboarding async — funcionou, não tocar

## Resposta direta às suas perguntas

**1. Por que o onboarding funcionou agora?**
Porque os 4 containers críticos (kong, auth, functions, db) estavam todos UP e o async job rodou em background sem segurar request HTTP. Vou confirmar nos logs no próximo turno e salvar como memória.

**2. Por que a geração de tarefas falhou?**
**Não é limite do usuário** (seria 429, não 503). É o **Gemini do Google que devolveu 503** — modelo sobrecarregado naquele momento. A função propaga corretamente, mas hoje não tenta de novo.

**3. App está pronto pra lançamento?**
Quase. Falta: o retry do guia diário/script (1 turno), o fix do healthcheck do Kong (1 comando na VPS), e validação dos itens da tabela acima. Estimo **2-3 ciclos** pra fechar tudo com segurança.

