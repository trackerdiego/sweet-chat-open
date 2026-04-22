

# Plano: integrar as correções do Claude (service role + fallback local) no projeto

## Contexto

Você trouxe duas Edge Functions reescritas pelo Claude (`generate-audience-profile` e `generate-personalized-matrix`) que resolvem 3 problemas reais que estão travando o onboarding no self-hosted (`api.influlab.pro`):

1. As funções usavam o cliente com **anon key** para fazer `upsert` em `audience_profiles` / `user_strategies`. No Lovable Cloud isso "passa" porque o ambiente é mais permissivo, mas no self-hosted RLS bloqueia silenciosamente → o salvamento nunca acontece → onboarding em loop.
2. `generate-personalized-matrix` usava `Promise.all` — se 1 semana falhasse, a matriz inteira morria.
3. Nenhuma das duas tinha **fallback local**: se Gemini demorasse/desse 504, o usuário ficava preso 1.5 min e via erro genérico.

## O que vou implementar

### 1. Substituir `supabase/functions/generate-audience-profile/index.ts`

Aplicar a versão do Claude com:

- `adminClient` usando `SUPABASE_SERVICE_ROLE_KEY` para todas as escritas em `user_profiles` e `audience_profiles`
- Validação do JWT do usuário com cliente anon (apenas `auth.getUser()`); writes via service role
- Timeout agressivo na chamada Gemini (~12s descrição / ~18s avatar)
- **Fallback local estruturado** quando Gemini falhar/demorar: monta `audience_description` e `avatar_profile` completos a partir do nicho, estilo e descrição do usuário (preenche todos os campos exigidos pelo schema do app)
- Retorno sempre 200 com `source: "ai" | "fallback"` e header `x-influlab-function-version` pra você confirmar que a VPS está rodando o código novo

### 2. Substituir `supabase/functions/generate-personalized-matrix/index.ts`

Aplicar a versão do Claude com:

- `adminClient` com service role para ler `audience_profiles` e gravar `user_strategies` + atualizar `user_profiles.onboarding_completed = true`
- Geração de **matriz local de 30 dias garantida** primeiro (usando `distributeVisceralElements` + nicho + estilo)
- `Promise.allSettled` por semana: cada semana que o Gemini conseguir melhorar, sobrescreve a matriz local; semanas que falham permanecem com fallback local
- `onboarding_completed = true` só é setado **depois** que `user_strategies` foi salvo com sucesso e validado (≥ 28 itens, idealmente 30)
- Header de versão para diagnóstico

### 3. Não tocar em `src/pages/Onboarding.tsx`

O Claude analisou e confirmou que o Onboarding já está bem: tem pipeline visível, retry por etapa, validação `verifyMatrixSaved`, redirect para `/auth` em 401, sem botão "continuar mesmo assim". As correções anteriores já feitas no frontend ficam.

### 4. Não tocar em `src/hooks/useUserProfile.ts` nem `useUserStrategies.ts`

Travas de integridade (matriz < 28 → onboarding=false; sem polling de session token durante onboarding) continuam valendo.

## Arquivos alterados

- `supabase/functions/generate-audience-profile/index.ts` — substituído pela versão com service role + fallback
- `supabase/functions/generate-personalized-matrix/index.ts` — substituído pela versão com service role + Promise.allSettled + matriz local garantida

## Arquivos NÃO alterados

- Frontend: nada
- Outras Edge Functions: nada
- Schema/RLS: nada (RLS continua igual; service role bypassa por design)
- `supabase/functions/_shared/gemini.ts`: mantido

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` já está configurado no projeto (confirmado em `<secrets>`). No self-hosted, você já tem essa secret no `docker-compose.yml` do GoTrue/PostgREST — então o deploy só precisa de `git pull` + redeploy das functions.

## Deploy obrigatório na VPS

Edge Functions mudam, então não basta Vercel:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

Conferir que a versão nova subiu:

```bash
curl -i -X OPTIONS https://api.influlab.pro/functions/v1/generate-audience-profile | grep -i x-influlab-function-version
```

Deve retornar o header com a versão nova. Se não retornar, o deploy não pegou.

## SQL de reset do `cakerollguide@gmail.com` (rodar no Studio self-hosted antes de testar)

```sql
-- Volta ao onboarding limpo + premium full pra testar tudo sem bater limite
update public.user_profiles
set onboarding_completed = false,
    description_status   = 'pending',
    active_session_token = null
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.audience_profiles
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.user_strategies
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

insert into public.user_usage (user_id, is_premium, tool_generations, chat_messages, script_generations, transcriptions)
select id, true, 0, 0, 0, 0
from auth.users where email = 'cakerollguide@gmail.com'
on conflict (user_id) do update
set is_premium = true,
    tool_generations = 0,
    chat_messages = 0,
    script_generations = 0,
    transcriptions = 0,
    last_tool_date = null,
    last_chat_date = null,
    last_script_date = null,
    last_transcription_date = null;

delete from public.user_progress
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
```

## Resultado esperado após deploy

- Etapa "Analisando seu público" responde em até ~18s **sempre** (IA ou fallback)
- Etapa "Matriz personalizada" responde em até ~40s **sempre**, com 30 dias garantidos
- Usuário nunca mais vê 504/1.5 min de espera no onboarding
- `audience_profiles` e `user_strategies` realmente são gravados (era o bug raiz no self-hosted)
- `onboarding_completed = true` só após matriz salva e validada
- Header `x-influlab-function-version` permite confirmar deploy correto na VPS

