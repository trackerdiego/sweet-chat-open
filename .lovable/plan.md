

## Problema crítico de segurança

Você acabou de colar o **JWT_SECRET** no chat. Esse é o segredo mais sensível de toda a stack — quem tem ele pode forjar JWTs com `role: service_role` e ter acesso TOTAL ao seu banco (bypassa todas as RLS).

**Ação obrigatória antes de qualquer outra coisa:**
1. Gerar um JWT_SECRET NOVO localmente (nunca em site online, nunca colar em chat):
   ```bash
   openssl rand -base64 48
   ```
2. Atualizar `GOTRUE_JWT_SECRET` e `PGRST_JWT_SECRET` no Easypanel com o novo valor
3. Restart dos containers `auth` e `rest`
4. Regenerar ANON_KEY e SERVICE_ROLE_KEY assinadas com o novo segredo
5. Cadastrar a nova SERVICE_ROLE_KEY nos secrets das edge functions do Studio
6. Me mandar SÓ a nova ANON_KEY (essa é pública, pode colar)

Eu **não preciso** do JWT_SECRET pra nada. Ele só fica no Easypanel. Eu só preciso da ANON_KEY (vai pro código) e você cadastra a SERVICE_ROLE direto nos secrets do Studio.

## Plano de execução (depois do reset do segredo)

**Etapa 1 — Validar a ANON_KEY nova contra o self-hosted**
Curl em `https://api.influlab.pro/rest/v1/user_profiles?select=user_id&limit=1` com `apikey` + `Authorization: Bearer`.
- 200 → segue
- 401 → JWT_SECRET no Easypanel não bate, parar

**Etapa 2 — Atualizar frontend**
- `src/integrations/supabase/client.ts`: trocar URL pra `https://api.influlab.pro` e SUPABASE_PUBLISHABLE_KEY pela nova ANON_KEY
- `.env`: atualizar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`

**Etapa 3 — Smoke test**
- `/auth/v1/signup` (email teste) → guardar access_token
- Verificar trigger `handle_new_user` (linha em `user_profiles`)
- `/functions/v1/send-push` (público) → 200
- `/functions/v1/ai-chat` (autenticado) → stream SSE

**Etapa 4 — Reportar pass/fail por endpoint**

