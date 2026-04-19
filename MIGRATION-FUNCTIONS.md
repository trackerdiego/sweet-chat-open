# Migração de Edge Functions → Supabase Self-Hosted (`api.influlab.pro`)

Guia para deployar as 14 edge functions colando o código manualmente no Studio do self-hosted.

---

## 0. Pré-requisitos

- Studio do self-hosted acessível (provavelmente `https://api.influlab.pro` ou `https://studio.influlab.pro`)
- Aba **Edge Functions** disponível no menu lateral. Se não existir, pare — esse caminho não funciona, será necessário SSH.
- Migrations do schema já aplicadas no banco self-hosted (mesmas tabelas do `types.ts`).

---

## 1. Configurar Secrets ANTES do deploy

No Studio → **Edge Functions → Secrets** (ou Project Settings → Edge Functions), adicione:

| Secret | Onde pegar |
|---|---|
| `GOOGLE_GEMINI_API_KEY` | Google AI Studio → API Keys |
| `ASAAS_API_KEY` | Painel Asaas → Integrações → API |
| `ASAAS_WEBHOOK_TOKEN` | Você define (string aleatória; cole o mesmo no webhook do Asaas) |
| `LOVABLE_API_KEY` | Painel Lovable Cloud → Settings → Secrets (copie o valor existente) |

**Automáticos** (não precisa criar — o Supabase injeta):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Ordem recomendada de deploy

Vai do mais simples ao mais complexo, permitindo testar incrementalmente.

### Bloco A — Auth & utilitárias (sem JWT)

| # | Nome exato | `verify_jwt` | Observação |
|---|---|---|---|
| 1 | `auth-email-hook` | **false** | Webhook chamado pelo GoTrue para enviar emails |
| 2 | `asaas-webhook` | **false** | Webhook do Asaas (valida via `ASAAS_WEBHOOK_TOKEN`) |
| 3 | `send-push` | **false** | Envio de push notification |
| 4 | `scheduled-push` | **false** | Disparado por cron |
| 5 | `process-email-queue` | **false** | Disparado por cron, valida JWT service_role no código |

### Bloco B — Funcionalidades autenticadas (JWT padrão)

| # | Nome exato | `verify_jwt` |
|---|---|---|
| 6 | `ai-chat` | true |
| 7 | `generate-script` | true |
| 8 | `generate-tools-content` | true |
| 9 | `generate-daily-guide` | true |
| 10 | `generate-audience-profile` | true |
| 11 | `generate-personalized-matrix` | true |
| 12 | `transcribe-media` | true |
| 13 | `create-asaas-subscription` | true |
| 14 | `admin-dashboard` | true |

### Como deployar cada uma

1. Studio → **Edge Functions → Create a new function**
2. **Name**: copie EXATAMENTE da tabela acima (case-sensitive, com hífens)
3. Cole o conteúdo de `supabase/functions/<nome>/index.ts` deste repo
4. Se for do Bloco A: marque/desmarque a opção **Verify JWT** = OFF (ou edite as configurações depois)
5. Salvar → Deploy

> **Atenção**: a function `auth-email-hook` está em `supabase/functions/auth-email-hook/index.ts` mas importa templates de `_shared/email-templates/`. Se o Studio não suportar pasta `_shared`, você terá que **inlinear** os templates dentro do `index.ts` antes de colar. (Mesmo para `process-email-queue` se houver imports compartilhados.)

---

## 3. Testes pós-deploy (curl)

Substitua `ANON` pelo anon key do self-hosted e `JWT` por um token de usuário logado (pegue no DevTools → Application → LocalStorage → `sb-...-auth-token`).

```bash
# 1. ai-chat (autenticada)
curl -i -X POST https://api.influlab.pro/functions/v1/ai-chat \
  -H "Authorization: Bearer JWT" \
  -H "apikey: ANON" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'

# 2. asaas-webhook (sem JWT, com token)
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "asaas-access-token: SEU_ASAAS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"externalReference":"USER_UUID"}}'

# 3. send-push (sem JWT — função interna)
curl -i -X POST https://api.influlab.pro/functions/v1/send-push \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_UUID","title":"Teste","body":"Funcionou"}'

# 4. scheduled-push
curl -i -X POST https://api.influlab.pro/functions/v1/scheduled-push \
  -H "Content-Type: application/json" -d '{}'

# 5. process-email-queue (exige service_role JWT)
curl -i -X POST https://api.influlab.pro/functions/v1/process-email-queue \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

Resposta esperada: `200` com JSON. `404` = function não foi criada com o nome exato. `401` = JWT inválido ou `verify_jwt` mal configurado. `500` = veja os logs no Studio.

---

## 4. Configurações no painel Auth do self-hosted

### 4.1 Auth Email Hook

Studio → **Authentication → Hooks → Send Email Hook**:
- **URL**: `https://api.influlab.pro/functions/v1/auth-email-hook`
- **Secret**: gere um novo no painel e adicione como secret no projeto chamado `SEND_EMAIL_HOOK_SECRET` (se a function usar — verifique o `index.ts`)

### 4.2 Site URL e Redirect URLs

Studio → **Authentication → URL Configuration**:
- **Site URL**: `https://app.influlab.pro`
- **Redirect URLs** (uma por linha):
  ```
  https://app.influlab.pro/**
  https://sweet-chat-open.lovable.app/**
  https://id-preview--ce48c5ee-b61d-4ce0-a218-eb4fa03033e7.lovable.app/**
  ```

### 4.3 Confirmação de email

Authentication → Providers → Email → **Confirm email = OFF** (memória do projeto: signup sem confirmação).

---

## 5. Webhook do Asaas

Painel Asaas → **Integrações → Webhooks**:
- **URL**: `https://api.influlab.pro/functions/v1/asaas-webhook`
- **Token**: cole o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Eventos**: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVE`

---

## 6. Cron Jobs (rodar no SQL Editor do self-hosted)

Habilite as extensões antes:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Substitua `ANON_KEY_AQUI` pelo anon key do self-hosted:

```sql
-- scheduled-push: a cada 15 minutos
select cron.schedule(
  'scheduled-push-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- process-email-queue: a cada 1 minuto (usa SERVICE_ROLE)
select cron.schedule(
  'process-email-queue-1min',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/process-email-queue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Verificar jobs ativos:
```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

Remover um job:
```sql
select cron.unschedule('scheduled-push-15min');
```

---

## 7. Storage

A function `transcribe-media` usa o bucket `media-uploads` (privado). Crie no Studio → **Storage**:
- Bucket: `media-uploads` — **Private**
- Policies: usuários autenticados podem `insert`/`select`/`delete` apenas em `<user_id>/...`

---

## 8. Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| `404 Not Found` em `/functions/v1/<nome>` | Nome digitado errado no Studio | Confira case e hífens |
| `401 Unauthorized` em function pública (webhook) | `verify_jwt` ficou `true` | Edite a function e desligue Verify JWT |
| `401` em function autenticada | Frontend não está enviando JWT, ou usuário deslogado | Faça login antes de testar |
| `500` com `LOVABLE_API_KEY is not configured` | Secret não foi adicionado | Adicione no Studio → Edge Functions → Secrets |
| `relation "public.user_usage" does not exist` | Migrations não aplicadas | Rode todas as migrations no banco self-hosted |
| Erro de import `_shared/...` | Studio não monta pastas compartilhadas | Inlinear o conteúdo dos arquivos `_shared` dentro do `index.ts` |
| CORS error no browser | Function não está retornando `Access-Control-Allow-Origin: *` | Já está no código — verifique se colou o arquivo inteiro, incluindo `corsHeaders` |
| Webhook do Asaas não ativa premium | `externalReference` vazio ou usuário não existe | Veja logs da function `asaas-webhook` no Studio |
| Push notifications não disparam | `pg_cron` não habilitado, ou job não criado | `select * from cron.job` para conferir |
| Email de signup não chega | Hook URL errado, ou `auth-email-hook` com `verify_jwt = true` | Configure conforme seção 4.1 |

---

## 9. Validação final (checklist)

- [ ] 14 functions listadas no Studio com status "Active"
- [ ] Login no app (`https://app.influlab.pro`) cria registro em `user_profiles`
- [ ] Onboarding gera `audience_profile` (testa `generate-audience-profile`)
- [ ] Matriz de 30 dias gera (testa `generate-personalized-matrix`)
- [ ] Chat responde (testa `ai-chat`)
- [ ] Webhook do Asaas ativa premium ao receber `PAYMENT_CONFIRMED`
- [ ] Cron jobs rodando (`select * from cron.job_run_details`)

---

## 10. Plano B: se Caminho B falhar

Se o Studio do self-hosted não tiver editor de Edge Functions, ou der erro persistente em mais de 3 functions, o caminho real é SSH no servidor:

```bash
rsync -av supabase/functions/ user@servidor:/opt/supabase/volumes/functions/
ssh user@servidor "cd /opt/supabase && docker compose restart functions"
```

E adicionar os secrets no `.env` do stack do Supabase (`docker compose up -d` recarrega).
