

## Análise da ANON_KEY recebida

Decodificando o JWT colado:
- Header: `{"alg":"HS256","typ":"JWT"}` ✅
- Payload: `{"role":"anon","iss":"supabase","iat":1713456000,"exp":2222222222}`
  - `iat: 1713456000` = 18/abr/2024 (mesmo timestamp da key fake anterior)
  - `exp: 2222222222` = 30/jan/2040 (sequência de 2s, claramente arbitrária)
- Signature: `77aQdZIDa1-f_i6OId9R6n-X_D9v6p9e5-9-r9a8w1o` — diferente da anterior

**Status:** estruturalmente é um JWT válido. Vai funcionar SE o `JWT_SECRET` que você usou pra assinar essa key for o mesmo cadastrado no Easypanel (em `GOTRUE_JWT_SECRET` e `PGRST_JWT_SECRET`).

**Atenção de segurança (já avisei antes, reforçando):** se o JWT_SECRET veio de site online, qualquer um pode forjar service_role. Recomendo rotacionar tudo localmente depois desse smoke test.

## Plano de execução

**Passo 1 — Validar a key contra o self-hosted (antes de tocar no código)**
```bash
curl -i "https://api.influlab.pro/rest/v1/user_profiles?select=user_id&limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```
- `200` + JSON (vazio ou com dados) → key bate com JWT_SECRET ✅ seguir
- `401 invalid JWT` ou `JWSError` → JWT_SECRET do Easypanel diferente do que assinou ❌ parar

**Passo 2 — Atualizar frontend (só se passo 1 passou)**
- `src/integrations/supabase/client.ts` → trocar `SUPABASE_PUBLISHABLE_KEY` pela nova ANON_KEY
- `.env` → atualizar `VITE_SUPABASE_URL="https://api.influlab.pro"` e `VITE_SUPABASE_PUBLISHABLE_KEY="<nova>"` (remover/ignorar o `VITE_SUPABASE_PROJECT_ID` antigo do cloud)

**Passo 3 — Smoke test completo**
Rodar em sequência:
- `/auth/v1/health` (já passou antes, reconfirmar com apikey)
- `/auth/v1/signup` com email teste → guardar `access_token` e `user.id`
- `/rest/v1/user_profiles?user_id=eq.<id>` com o JWT do signup → confirma trigger `handle_new_user` rodou
- `/functions/v1/send-push` (público) → 200 esperado
- `/functions/v1/ai-chat` com Bearer do signup → stream SSE esperado

**Passo 4 — Reportar resultado**
Tabela pass/fail por endpoint. Se algo falhar, diagnóstico exato (JWT_SECRET errado, function não deployada, secret faltando, trigger ausente, etc.).

## O que NÃO vou fazer
- Não vou tocar no `client.ts` antes do passo 1 retornar 200 (evita quebrar app que talvez ainda esteja funcionando de algum jeito)
- Não vou pedir SERVICE_ROLE_KEY no chat
- Não vou atualizar secrets do Lovable Cloud (esses ficam órfãos — secrets do self-hosted você cadastra no Studio do `api.influlab.pro`)

