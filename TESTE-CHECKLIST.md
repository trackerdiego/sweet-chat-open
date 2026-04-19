# Checklist de Validação — Self-Hosted (`api.influlab.pro`)

Execute na ordem. **Pare no primeiro teste que falhar** e resolva antes de continuar.

Substitua antes de começar:
- `ANON_KEY` → anon key do self-hosted
- `SERVICE_ROLE_KEY` → service role key do self-hosted
- `ASAAS_WEBHOOK_TOKEN_VALUE` → valor do secret cadastrado
- `JWT_DO_SIGNUP` → `access_token` retornado no teste 2.1
- `USER_UUID_REAL` → UUID de um usuário real (pegue em `auth.users`)

---

## Etapa 1 — Infra básica

### [ ] 1.1 Domínio respondendo
```bash
curl -i https://api.influlab.pro/auth/v1/health
```
**Esperado:** `200 OK` com JSON `{"name":"GoTrue",...}`
**Se falhar:**
- `404` → nginx/proxy do Easypanel não está roteando `/auth/v1/*` pro container do GoTrue
- `timeout` → DNS não propagou ou firewall da Contabo bloqueando 443
- `502` → container `auth` (GoTrue) caído — `docker ps` no servidor

### [ ] 1.2 PostgREST respondendo
```bash
curl -i https://api.influlab.pro/rest/v1/ \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ANON_KEY"
```
**Esperado:** JSON grande (swagger do PostgREST listando tabelas)
**Se falhar:**
- `401 invalid JWT` → anon key errada ou JWT_SECRET do stack não bate com a chave
- `404` → rota `/rest/v1/*` não configurada no proxy

---

## Etapa 2 — Auth + trigger de novo usuário

### [ ] 2.1 Signup via curl
```bash
curl -i -X POST https://api.influlab.pro/auth/v1/signup \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste1@influlab.pro","password":"Teste12345!","data":{"display_name":"Teste"}}'
```
**Esperado:** `200` com JSON contendo `access_token` e `user.id`
**Guarde:** o `access_token` (vira `JWT_DO_SIGNUP`) e o `user.id` (vira `USER_UUID_REAL`)
**Se falhar:**
- `422 email_address_invalid` → use um email real, não `+1` se o GoTrue rejeitar
- `500` → SMTP mal configurado E `MAILER_AUTOCONFIRM=false`. Setar `GOTRUE_MAILER_AUTOCONFIRM=true` no env do stack.

### [ ] 2.2 Trigger `handle_new_user` rodou
No SQL Editor do Studio (ou `psql`):
```sql
select user_id, display_name, onboarding_completed, description_status
from public.user_profiles
where user_id = (select id from auth.users where email = 'teste1@influlab.pro');
```
**Esperado:** 1 linha com `display_name = 'Teste'`, `onboarding_completed = false`, `description_status = 'pending'`
**Se falhar (0 linhas):** trigger não foi criado. Rode no SQL Editor:
```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## Etapa 3 — Edge Functions

### [ ] 3.1 Listar functions ativas
Studio → Edge Functions: devem aparecer **14** com status Active:
`admin-dashboard`, `ai-chat`, `asaas-webhook`, `auth-email-hook`, `create-asaas-subscription`, `generate-audience-profile`, `generate-daily-guide`, `generate-personalized-matrix`, `generate-script`, `generate-tools-content`, `process-email-queue`, `scheduled-push`, `send-push`, `transcribe-media`

**Se faltar alguma:** veja `MIGRATION-FUNCTIONS.md` seção 2 e redeploy a faltante.

### [ ] 3.2 Function pública (`send-push`, sem JWT)
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/send-push \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","title":"t","body":"b"}'
```
**Esperado:** `200` ou erro de "no subscriptions" (mas NÃO `404` e NÃO `401`)
**Se `401`:** a function ficou com `verify_jwt = true`. Edite no Studio e desligue.
**Se `404`:** nome da function digitado errado no deploy.

### [ ] 3.3 Function autenticada (`ai-chat`)
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/ai-chat \
  -H "Authorization: Bearer JWT_DO_SIGNUP" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'
```
**Esperado:** `200` com stream SSE da IA
**Se falhar:**
- `401` → JWT expirado (refaça 2.1) ou `verify_jwt` mal configurado
- `500 LOVABLE_API_KEY is not configured` → cadastre o secret no Studio
- `429` → limite de mensagens (esperado se já testou várias vezes)

### [ ] 3.4 Webhook Asaas (sem JWT, com token customizado)
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "asaas-access-token: ASAAS_WEBHOOK_TOKEN_VALUE" \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"externalReference":"USER_UUID_REAL"}}'
```
**Esperado:** `200 {"received":true}`
**Validar efeito:**
```sql
select user_id, is_premium from public.user_usage where user_id = 'USER_UUID_REAL';
```
Deve retornar `is_premium = true`.
**Se 401:** token errado. Confira o secret `ASAAS_WEBHOOK_TOKEN`.

---

## Etapa 4 — Frontend conectado

### [ ] 4.1 Abrir o app
URL: `https://app.influlab.pro` (ou preview Lovable)

### [ ] 4.2 Network tab
DevTools → Network → fazer signup novo pelo formulário.
**Esperado:** todas as requests vão pra `api.influlab.pro`. Nenhuma pra `gchncrlrmsyzumgmbplh.supabase.co`.

### [ ] 4.3 Console limpo
Sem erros `401`, `404`, `CORS` ou `Failed to fetch`.

### [ ] 4.4 Onboarding end-to-end
- Step "Análise de Nicho" → roda `generate-audience-profile` (~10s)
- Step "Estudo Visceral" → mesma function, gera avatar
- Step "Matriz" → roda `generate-personalized-matrix` (~30s)
- Step "Finalização" → grava `onboarding_completed = true`

**Se travar em algum step:** Studio → Edge Functions → Logs da function correspondente.

### [ ] 4.5 Consultor IA
Abra o chat → mande "oi" → deve responder em streaming.

### [ ] 4.6 Login em outro dispositivo (single-session)
Faça login num segundo navegador. O primeiro deve deslogar em até 30s (polling do `active_session_token`).

---

## Etapa 5 — Cron jobs

```sql
select jobname, schedule, active from cron.job;
```
**Esperado:** 2 linhas, ambas `active = true`:
- `scheduled-push-15min` → `*/15 * * * *`
- `process-email-queue-1min` → `* * * * *`

```sql
select jobname, status, return_message, start_time
from cron.job_run_details
order by start_time desc limit 10;
```
**Esperado:** execuções recentes com `status = 'succeeded'`.
**Se `failed`:** veja `return_message`. Causa comum: anon/service key errada no SQL do `cron.schedule`.

---

## Etapa 6 — Storage (transcrição de mídia)

### [ ] 6.1 Bucket existe
Studio → Storage: bucket `media-uploads` existe, **Private**.

### [ ] 6.2 Upload teste pelo app
App → Tools → "Transcrever áudio/vídeo" → upload de um MP3 curto (< 5 MB).
**Esperado:** transcrição retorna em < 30s.
**Se falhar:**
- "permission denied" → policies do bucket não criadas. Crie:
  ```sql
  create policy "users upload own media"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'media-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "users read own media"
    on storage.objects for select to authenticated
    using (bucket_id = 'media-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "users delete own media"
    on storage.objects for delete to authenticated
    using (bucket_id = 'media-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
  ```

---

## Etapa 7 — Webhook Asaas real (opcional, em produção)

No painel Asaas, dispare um pagamento de teste (sandbox) com `externalReference` = um user real.
Confira no log da function `asaas-webhook` no Studio que o evento chegou e que `is_premium` virou `true`.

---

## Validação final

- [ ] Todos os checks acima marcados
- [ ] Nenhum erro no console do app durante uso normal
- [ ] Logs das functions sem `500` recorrentes
- [ ] `select count(*) from auth.users` cresce conforme novos signups
- [ ] Pagamento real do Asaas ativou premium

Se tudo verde → migração concluída. 🎉
