# Migração de Edge Functions — Self-Hosted

Este projeto roda em Supabase **self-hosted** (`api.influlab.pro`). Todas as edge
functions usam **Google Gemini direto** (não dependem do Lovable AI Gateway).

## Functions

### Públicas (verify_jwt = false)
- `asaas-webhook` — recebe eventos de pagamento do Asaas
- `send-push` — envio público de push notification
- `scheduled-push` — invocada por cron a cada 15 min
- `process-email-queue` — invocada por cron a cada 1 min
- `auth-email-hook` — webhook do GoTrue para envio de emails

### Privadas (com JWT do usuário)
- `ai-chat` — Consultor IA (streaming SSE) — Gemini
- `generate-script` — geração de script — Gemini
- `generate-tools-content` — ferramentas IA — Gemini
- `generate-daily-guide` — guia diário — Gemini
- `generate-audience-profile` — análise visceral — Gemini
- `generate-personalized-matrix` — matriz 30 dias — Gemini
- `transcribe-media` — transcrição áudio/vídeo — Gemini
- `admin-dashboard` — dados do painel admin
- `create-asaas-subscription` — cria assinatura no Asaas

## Self-Hosted Deploy

### 1. Pré-requisitos locais
- Supabase CLI instalado
- Docker rodando localmente
- `SUPABASE_ACCESS_TOKEN` (gere em Studio → Account → Access Tokens)
- `PROJECT_REF` (ref do projeto no self-hosted)

### 2. Deploy automatizado

```bash
export SUPABASE_ACCESS_TOKEN=<seu-token>
export PROJECT_REF=<ref-do-self-hosted>
chmod +x scripts/deploy-selfhost.sh
./scripts/deploy-selfhost.sh --secrets   # primeira vez
./scripts/deploy-selfhost.sh             # próximas
```

O script vai pedir `GOOGLE_GEMINI_API_KEY` e `ASAAS_API_KEY`. O `ASAAS_WEBHOOK_TOKEN` é gerado automaticamente — **salve o valor impresso** e cadastre no painel Asaas como header do webhook.

### 3. SQL pós-deploy (cole no SQL Editor do Studio)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'scheduled-push-15min', '*/15 * * * *',
  $$ select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

select cron.schedule(
  'process-email-queue-1min', '* * * * *',
  $$ select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/process-email-queue',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

create policy "user reads own media"
  on storage.objects for select to authenticated
  using (bucket_id = 'media-uploads' and owner = auth.uid());

create policy "user uploads own media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media-uploads' and owner = auth.uid());

create policy "user deletes own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media-uploads' and owner = auth.uid());
```

### 4. Smoke test

```bash
curl -i https://api.influlab.pro/functions/v1/send-push -H "Content-Type: application/json" -d '{}'
curl -i https://api.influlab.pro/functions/v1/ai-chat -H "Authorization: Bearer <USER_JWT>" -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"oi"}]}'
```

## Secrets esperadas

| Secret | Origem | Usada por |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | auto | todas |
| `GOOGLE_GEMINI_API_KEY` | manual | ai-chat, generate-*, transcribe-media |
| `ASAAS_API_KEY` | manual | create-asaas-subscription, asaas-webhook |
| `ASAAS_WEBHOOK_TOKEN` | gerado pelo script | asaas-webhook |
