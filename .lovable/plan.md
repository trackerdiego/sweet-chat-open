

User confirmed: Opção A (Gemini direto, sem Lovable AI Gateway). Quer o script de deploy + bloco SQL final.

Plano:

## Etapa 1 — Refatorar 6 functions pra Gemini direto

Substituir em cada uma:

**De:**
```ts
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, ... })
})
```

**Para:**
```ts
const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
  headers: { Authorization: `Bearer ${GEMINI_KEY}` },
  body: JSON.stringify({ model: "gemini-2.5-flash", messages, ... })
})
```

Endpoint compatível com OpenAI já é usado em `generate-script` — só replicar nas 5 outras.

Functions afetadas: `ai-chat`, `generate-tools-content`, `generate-daily-guide`, `generate-audience-profile`, `generate-personalized-matrix`, `transcribe-media` (verificar se usa Lovable Gateway).

## Etapa 2 — Criar `scripts/deploy-selfhost.sh`

Script bash que você roda local apontando pro `api.influlab.pro`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Pré-requisitos: supabase CLI instalado, Docker rodando
# Uso: SUPABASE_ACCESS_TOKEN=xxx PROJECT_REF=xxx ./scripts/deploy-selfhost.sh

: "${SUPABASE_ACCESS_TOKEN:?precisa do token}"
: "${PROJECT_REF:?precisa do ref do self-hosted}"

# 1. Link
supabase link --project-ref "$PROJECT_REF"

# 2. Secrets (interativo — só roda 1x)
if [[ "${1:-}" == "--secrets" ]]; then
  read -srp "GOOGLE_GEMINI_API_KEY: " GK; echo
  read -srp "ASAAS_API_KEY: " AK; echo
  ATK=$(openssl rand -hex 24)
  supabase secrets set GOOGLE_GEMINI_API_KEY="$GK" ASAAS_API_KEY="$AK" ASAAS_WEBHOOK_TOKEN="$ATK"
  echo "ASAAS_WEBHOOK_TOKEN gerado: $ATK (salve)"
fi

# 3. Deploy de todas as 14 functions
PUBLIC_FNS=(asaas-webhook send-push scheduled-push process-email-queue auth-email-hook)
PRIVATE_FNS=(ai-chat generate-script generate-tools-content generate-daily-guide \
             generate-audience-profile generate-personalized-matrix \
             transcribe-media admin-dashboard create-asaas-subscription)

for fn in "${PUBLIC_FNS[@]}"; do
  supabase functions deploy "$fn" --no-verify-jwt
done
for fn in "${PRIVATE_FNS[@]}"; do
  supabase functions deploy "$fn"
done

echo "✅ Deploy concluído"
```

## Etapa 3 — Bloco SQL pra rodar no SQL Editor do `api.influlab.pro`

Inclui: extensions, cron jobs, storage policies. Você cola um bloco só.

```sql
-- Extensions necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cron: scheduled-push a cada 15 min
select cron.schedule(
  'scheduled-push-15min', '*/15 * * * *',
  $$ select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Cron: process-email-queue a cada 1 min
select cron.schedule(
  'process-email-queue-1min', '* * * * *',
  $$ select net.http_post(
    url := 'https://api.influlab.pro/functions/v1/process-email-queue',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Storage policies pro bucket media-uploads (privado)
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

## Etapa 4 — Documentar no README do repo

Adicionar seção "Self-Hosted Deploy" no `MIGRATION-FUNCTIONS.md` com passo-a-passo.

## Ordem de execução pra você
1. Eu refatoro as functions (5 arquivos editados)
2. Eu crio `scripts/deploy-selfhost.sh`
3. Eu te entrego o bloco SQL nesta conversa pra você colar no SQL Editor
4. Você roda local: `chmod +x scripts/deploy-selfhost.sh && ./scripts/deploy-selfhost.sh --secrets`
5. Você cola o SQL no Studio
6. Reportar pass/fail

