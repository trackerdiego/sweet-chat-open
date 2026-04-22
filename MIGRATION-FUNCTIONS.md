# Migração de Edge Functions — Self-Hosted

Backend roda em Supabase **self-hosted** (`api.influlab.pro`). Functions usam **Google Gemini direto**.

## Functions

### Públicas (verify_jwt = false)
- `asaas-webhook`, `send-push`, `scheduled-push`, `process-email-queue`, `auth-email-hook`

### Privadas (com JWT do usuário)
- `ai-chat`, `generate-script`, `generate-tools-content`, `generate-daily-guide`
- `generate-audience-profile`, `generate-personalized-matrix`
- `start-onboarding-run`, `get-onboarding-run-status` *(arquitetura assíncrona — anti-timeout Kong/Nginx)*
- `transcribe-media`, `admin-dashboard`, `create-asaas-subscription`

---

## 1. SQL no banco self-hosted

**NUNCA cole SQL direto no bash** — só dá `command not found`. Use uma das três opções:

### Opção A — Studio SQL Editor (recomendado)
Abra `https://studio.influlab.pro` (ou onde o Studio estiver) → SQL Editor → cole e rode.

### Opção B — psql via docker exec
```bash
docker exec -it supabase-db psql -U postgres -d postgres
# (cola o SQL e dá enter)
```

### Opção C — psql como arquivo
```bash
cat > /tmp/migra.sql <<'SQL'
update public.user_profiles set onboarding_completed = false where ...;
SQL
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/migra.sql
```

---

## 2. Deploy das edge functions

O script `scripts/deploy-selfhost.sh` tem **dois modos automáticos**:

### Modo A — CLI (com token)
```bash
export SUPABASE_ACCESS_TOKEN=<token-do-studio>
export PROJECT_REF=<ref-self-hosted>
./scripts/deploy-selfhost.sh
```

### Modo B — Docker fallback (sem token, padrão na VPS)
Se as variáveis acima **não** estiverem definidas, o script entra automaticamente em modo Docker:
- detecta o stack `supabase/docker` (procura em `~/supabase/docker`, `/root/supabase/docker`, etc.)
- copia `supabase/functions/*` para `<stack>/volumes/functions/`
- faz `docker compose restart functions`
- aguarda o container voltar
- valida cada function crítica

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

> Se o stack estiver em outro caminho, exporte `SUPABASE_DOCKER_DIR=/caminho/pro/supabase/docker`.

---

## 3. Validação pós-deploy

O próprio script roda essa checagem no final, mas dá pra rodar manual também:

```bash
for fn in start-onboarding-run get-onboarding-run-status generate-audience-profile generate-personalized-matrix; do
  echo -n "$fn → "
  curl -sI -X OPTIONS "https://api.influlab.pro/functions/v1/$fn" \
    | grep -i 'x-influlab-function-version' || echo "❌ não publicada"
done
```

**Esperado:** cada linha mostra `x-influlab-function-version: 2026-04-22-async-job` (ou versão posterior).

Se aparecer `❌ não publicada`:
- confira `docker ps | grep functions` — container precisa estar `Up`
- confira logs: `docker logs supabase-edge-functions --tail 100`
- confira que o volume montado em `/home/deno/functions` aponta pra pasta certa no `docker-compose.yml`

---

## 3.1 docker-compose.yml quebrou — diagnóstico rápido

Se o script abortar com `yaml: ... did not find expected key`, o `docker-compose.yml` do stack self-hosted está com erro de indentação. Diagnóstico:

```bash
cd /root/supabase/docker && docker compose config
```

Isso aponta a **linha exata** do problema. As 3 pegadinhas mais comuns:

1. **`environment:` com indentação errada** — precisa ficar no mesmo nível de `volumes:` (4 espaços dentro do service). Se aparecer com 3 espaços, o parser quebra.
2. **`depends_on:` duplicado no mesmo service** — YAML não aceita duas chaves iguais. Mescle em um só bloco:
   ```yaml
   depends_on:
     analytics:
       condition: service_healthy
     studio:
       condition: service_healthy
   ```
3. **Mistura de tab e espaço** — YAML é sensível. Use só espaço.

Depois de consertar, valide antes de subir:

```bash
cd /root/supabase/docker && docker compose config -q && echo OK
docker compose up -d --force-recreate functions
```

> O `deploy-selfhost.sh` já roda esse pré-check automaticamente — se o YAML estiver quebrado ele falha cedo com mensagem clara.

---

## 4. SQL pós-deploy (uma vez só, no Studio)

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

---

## 5. Smoke test do onboarding assíncrono

```bash
# 1) inicia run (precisa de JWT de usuário)
curl -i -X POST https://api.influlab.pro/functions/v1/start-onboarding-run \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Teste","primaryNiche":"fitness","audienceDescription":"..."}'

# 2) polling (responde em <1s, repita até status=completed)
curl -s https://api.influlab.pro/functions/v1/get-onboarding-run-status?runId=<RUN_ID> \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "apikey: <ANON_KEY>"
```

Nenhuma das duas chamadas pode chegar perto de 60s — esse é o ponto de toda a arquitetura.

---

## 6. Healthcheck do Kong (pré-lançamento)

O healthcheck padrão do Kong no stack self-hosted (`kong health` em 5s) é flaky e marca o container como `unhealthy` mesmo quando o tráfego funciona. Isso quebra `depends_on` de outros services (ex.: `functions`) se a VPS reiniciar — foi exatamente o que aconteceu na quebra de 22-abr.

**Antes do lançamento**, ajuste no `~/supabase/docker/docker-compose.yml`, no service `kong`:

```yaml
healthcheck:
  test: ["CMD", "kong", "health"]
  interval: 10s
  timeout: 10s
  retries: 5
  start_period: 60s   # ← era 5s, sobe pra 60s pra dar tempo do Kong booter
```

Depois: `cd /root/supabase/docker && docker compose up -d --force-recreate kong` e confira `docker compose ps kong` — em ~60s deve mostrar `(healthy)`.

---

## 7. Resiliência Gemini 503 (já no código)

`generate-daily-guide` e `generate-script` agora fazem **2 tentativas no nível da função** (com 2s entre elas) em cima do retry interno do `_shared/gemini.ts` (primary + fallback de modelo). Total: até ~6 tentativas por chamada de IA antes de devolver 503 pro frontend.

**Cota só é consumida em sucesso** — usuário que pegar 503 não perde geração.

Frontend (`DailyGuide.tsx`) mostra toast diferenciado: 429 = limite atingido, 503 = Gemini instável (cota preservada).

---

## Secrets esperadas

| Secret | Origem | Usada por |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | auto | todas |
| `GOOGLE_GEMINI_API_KEY` | manual | ai-chat, generate-*, transcribe-media, start-onboarding-run |
| `ASAAS_API_KEY` | manual | create-asaas-subscription, asaas-webhook |
| `ASAAS_WEBHOOK_TOKEN` | gerado pelo script | asaas-webhook |

No self-hosted, secrets vivem em `~/supabase/docker/.env` **e** precisam estar listadas em `environment:` do service `functions` no `docker-compose.yml`. Após editar: `docker compose up -d --force-recreate functions`.
