

## Plano: Testar se a migração self-hosted está funcionando

Bateria de testes do mais básico (DNS) ao mais complexo (fluxo end-to-end no app), pra você executar em ordem e parar no primeiro que falhar.

### Etapa 1 — Infra básica (antes de testar functions)

**1.1 Domínio respondendo**
```bash
curl -i https://api.influlab.pro/auth/v1/health
```
Esperado: `200 OK`. Se 404/timeout → DNS ou nginx do Easypanel mal configurado.

**1.2 Anon key válida (REST do PostgREST)**
```bash
curl -i https://api.influlab.pro/rest/v1/ \
  -H "apikey: ANON_KEY" -H "Authorization: Bearer ANON_KEY"
```
Esperado: JSON com swagger do PostgREST.

### Etapa 2 — Auth funcionando

**2.1 Signup teste via curl**
```bash
curl -i -X POST https://api.influlab.pro/auth/v1/signup \
  -H "apikey: ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"teste+1@influlab.pro","password":"Teste12345!"}'
```
Esperado: `200` com `access_token` no JSON.

**2.2 Verificar que o trigger `handle_new_user` rodou**
No SQL Editor do Studio:
```sql
select user_id, display_name, onboarding_completed 
from public.user_profiles 
where user_id = (select id from auth.users where email = 'teste+1@influlab.pro');
```
Esperado: 1 linha. Se vazio → trigger não foi criado nas migrations.

### Etapa 3 — Edge Functions deployadas

**3.1 Listar functions ativas**
No Studio do self-hosted: aba Edge Functions deve mostrar 14 ativas.

**3.2 Function pública (sem JWT)**
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/send-push \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","title":"t","body":"b"}'
```
Esperado: 200 ou erro de "user not found" (mas não 404).

**3.3 Function autenticada (com JWT do signup acima)**
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/ai-chat \
  -H "Authorization: Bearer JWT_DO_SIGNUP" \
  -H "apikey: ANON_KEY" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'
```
Esperado: 200 com resposta da IA. 401 → JWT/verify_jwt mal configurado. 500 → secret `LOVABLE_API_KEY` não cadastrado.

### Etapa 4 — Frontend conectado

**4.1 Abrir o app publicado** (`https://app.influlab.pro` ou preview Lovable)

**4.2 DevTools → Network** — fazer signup novo

Verificar que requests vão pra `api.influlab.pro` (não pra `gchncrlrmsyzumgmbplh.supabase.co`).

**4.3 Console** — não pode ter erros 401/404/CORS

**4.4 Fazer onboarding completo**
- Step 1 (nicho): testa `generate-audience-profile`
- Step final: testa `generate-personalized-matrix`

Se ambos completarem → IA + DB + Auth estão integrados.

### Etapa 5 — Cron jobs rodando

No SQL Editor:
```sql
select jobname, schedule, active from cron.job;
select jobname, status, return_message, start_time 
from cron.job_run_details order by start_time desc limit 10;
```
Esperado: 2 jobs ativos (`scheduled-push-15min`, `process-email-queue-1min`), execuções recentes com status `succeeded`.

### Etapa 6 — Webhook Asaas

**6.1 Disparar webhook fake via curl**
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "asaas-access-token: SEU_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"externalReference":"USER_UUID_REAL"}}'
```

**6.2 Verificar que premium foi ativado**
```sql
select user_id, is_premium from public.user_usage where user_id = 'USER_UUID_REAL';
```
Esperado: `is_premium = true`.

### Etapa 7 — Storage

No Studio → Storage: bucket `media-uploads` existe e é privado. Upload teste de áudio pequeno via app (Tools → transcribe) deve completar.

### O que vou criar

Arquivo único **`TESTE-CHECKLIST.md`** na raiz com:
- Os 7 blocos acima em ordem de execução
- Cada teste com comando curl/SQL pronto pra copiar
- Coluna "Resultado esperado" + "Se falhar, faz isso"
- Espaço pra você marcar `[x]` conforme passa

Não preciso reescrever `MIGRATION-FUNCTIONS.md` — esse arquivo é o guia de **deploy**, o novo é o guia de **validação pós-deploy**.

