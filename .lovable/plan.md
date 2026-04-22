

# Plano: deploy das edge functions assíncronas na VPS self-hosted

## Status atual

- SQL da `onboarding_runs` aplicado no banco self-hosted ✅
- `git pull` na VPS trouxe os arquivos novos ✅
- `./scripts/deploy-selfhost.sh` falhou: `SUPABASE_ACCESS_TOKEN` não definido ❌
- `curl` em `start-onboarding-run` não retorna `x-influlab-function-version` → função não publicada ❌

Falta apenas **publicar as edge functions** na VPS.

## O que vou fazer

### 1. Refatorar `scripts/deploy-selfhost.sh` com 2 modos

**Modo CLI** (atual): exige `SUPABASE_ACCESS_TOKEN` + `PROJECT_REF`, usa `supabase functions deploy`.

**Modo Docker fallback** (novo): se as variáveis não existirem, o script:
- detecta o caminho do volume das functions (`~/supabase/docker/volumes/functions/` ou via `docker compose config`)
- faz `rsync` das pastas em `supabase/functions/` para o volume
- roda `docker compose -f ~/supabase/docker/docker-compose.yml restart functions`
- aguarda o container voltar saudável
- valida cada function nova com `curl -I` checando `x-influlab-function-version`

Isso elimina a dependência de token CLI no self-hosted.

### 2. Adicionar bloco de validação automatizada no fim do script

Após o deploy, rodar automaticamente:

```bash
for fn in start-onboarding-run get-onboarding-run-status generate-audience-profile generate-personalized-matrix; do
  curl -sI -X OPTIONS "https://api.influlab.pro/functions/v1/$fn" \
    | grep -i 'x-influlab-function-version' \
    && echo "✅ $fn OK" \
    || echo "❌ $fn não publicada"
done
```

Resultado claro no terminal: o usuário sabe na hora se cada function subiu.

### 3. Atualizar `MIGRATION-FUNCTIONS.md`

Adicionar 3 seções curtas:
- **SQL no Studio**: como aplicar SQL via Studio SQL Editor ou `docker exec ... psql` (nunca no bash puro)
- **Deploy sem token**: explicação do modo fallback
- **Validação pós-deploy**: comandos `curl` de checagem do header de versão

### 4. Comando final que o usuário vai rodar

Depois das mudanças, o ciclo completo na VPS vira:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

Sem precisar de token. Sem precisar lembrar de comandos de Docker. O script detecta o cenário e age sozinho.

## Arquivos alterados

- `scripts/deploy-selfhost.sh` — adiciona modo Docker fallback + validação automática
- `MIGRATION-FUNCTIONS.md` — atualiza runbook self-hosted

## Arquivos NÃO alterados

- Frontend (`Onboarding.tsx`, `useOnboardingRun.ts`) — já corretos
- Edge Functions (`start-onboarding-run`, `get-onboarding-run-status`, etc.) — já corretas
- Schema do banco — `onboarding_runs` já criada
- Hooks de integridade (`useUserProfile`, `useUserStrategies`) — intactos

## Reset do usuário de teste (rodar no Studio SQL Editor, não no bash)

```sql
update public.user_profiles
set onboarding_completed = false,
    description_status   = 'pending',
    active_session_token = null
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.audience_profiles where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
delete from public.user_strategies   where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
delete from public.user_progress     where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
delete from public.onboarding_runs   where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

insert into public.user_usage (user_id, is_premium)
select id, true from auth.users where email = 'cakerollguide@gmail.com'
on conflict (user_id) do update
set is_premium = true,
    tool_generations = 0, chat_messages = 0,
    script_generations = 0, transcriptions = 0,
    last_tool_date = null, last_chat_date = null,
    last_script_date = null, last_transcription_date = null;
```

## Resultado esperado

- `./scripts/deploy-selfhost.sh` roda sem token e publica as 4 functions afetadas
- Validação automática no fim do script confirma `x-influlab-function-version` em cada uma
- Usuário consegue testar o onboarding assíncrono completo no app
- Primeira impressão deixa de ser 504/erro

