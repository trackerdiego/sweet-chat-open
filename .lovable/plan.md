

# Diagnóstico: o "Erro ao salvar perfil" é o single-session-limit deslogando o próprio usuário

## O que acontece (lendo o print de network)

A sequência das requisições no print é:

```text
GET user_profiles?select=active_session_token  → 200  (polling de single-session)
GET user_profiles?select=active_session_token  → 200  (polling de single-session)
GET user_profiles?user_id=eq.353d1276-...      → 406  (← aqui já não tem sessão válida)
GET user_profiles?user_id=eq.353d1276-...      → 406
POST user_profiles?on_conflict=user_id          → 401  (← o upsert do handleFinish)
GET user_profiles?select=active_session_token  → 200
GET user_profiles?select=active_session_token  → 200
```

Tradução: enquanto o usuário estava no passo 3 do onboarding, **a sessão JWT dele caducou ou o `active_session_token` no banco passou a divergir do que ele tem em localStorage**. Quando ele clicou "Começar Jornada":

1. `updateProfile` chamou `.update().eq('user_id', userId).select().single()` — o servidor já não autenticava como o dono da row → PostgREST retorna **406** (RLS filtra a row, `.single()` não acha nada e responde Not Acceptable).
2. O retry imediato deu mesma 406.
3. O fallback `.upsert(...)` exige INSERT permission e o servidor responde **401** porque o JWT não é mais válido.
4. Toast: "Erro ao salvar perfil. Tente novamente." → o usuário fica preso, porque qualquer clique a partir daí dispara o mesmo 401.

A causa é o `useUserProfile.fetchProfile`: assim que o perfil é carregado, ele **sobrescreve o `active_session_token` com um novo UUID**. Se o usuário tem outra aba (ou abriu o link em duas janelas, ou entrou via banner do PWA + Safari), uma das duas sobrescreve a outra e a vítima começa a tomar 401 sem aviso visual — só descobre quando tenta salvar.

Combinado com o erro 406 "happy path" do PostgREST, a UX vira: clica → erro genérico → tenta de novo → mesmo erro → desiste.

## Correção em 4 frentes

### 1. Não invalidar a sessão durante o onboarding

Em `useUserProfile.fetchProfile`, hoje:

```text
- carrega profile
- gera novo session_token e grava no banco
- inicia polling a cada 30s — se token divergir, signOut imediato
```

Mudança: **não rotacionar o `active_session_token` enquanto o usuário ainda não completou o onboarding** (`profile.onboarding_completed === false`). O polling também não roda nesse caso. Isso elimina:

- A janela em que duas abas se chutam mutuamente
- O risco de cair na metade do pipeline e perder o progresso
- A 401 silenciosa no `handleFinish`

O lock de single-session passa a valer apenas para usuários já no app (após onboarding), que é o cenário de "compartilhamento de login" que motivou a feature.

### 2. Tratar 401/406 em `updateProfile` e `handleFinish` com mensagem real

Hoje `updateProfile` retorna `{ data, error }` mas `handleFinish` só checa `result?.error`. Quando a sessão cai e `updateProfile` retorna `undefined` (porque `if (!session?.user) return;`), `result?.error` é `undefined` → falsy → vai pro fallback `.upsert` que toma 401 → erro genérico.

Mudanças:

- `updateProfile` passa a detectar `error.code === 'PGRST116'` (single() sem row) e código 401, retornar erro estruturado
- `handleFinish` passa a:
  - Re-checar a sessão via `supabase.auth.getSession()` antes de qualquer write
  - Se sessão inválida → `toast.error("Sua sessão expirou. Faça login novamente.")` + redirect para `/auth`
  - Se 406 no update (perfil sumiu): tentar `upsert` direto com `user_id` do `getUser()`
  - Se 401: redirect pro login, não ficar travado

### 3. Remover o fallback que mascara o erro real

A sequência atual `update → retry → upsert` esconde a causa. O fluxo passa a ser:

```text
1. getSession() — sessão válida?
   não → redirect /auth
2. upsert direto (insere se não existir, atualiza se existir) — uma só request
3. se erro: mostra a mensagem específica do erro
```

Isso elimina o duplo round-trip e torna o erro diagnosticável.

### 4. Destravar o usuário no banco (manual no self-hosted)

Como o backend é Supabase self-hosted (`api.influlab.pro`) e o `supabase--read_query` aqui aponta pro Lovable Cloud, o reset precisa ser executado por você manualmente no SQL Editor do self-hosted:

```sql
update public.user_profiles
set onboarding_completed = false,
    description_status   = 'pending',
    active_session_token = null
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.audience_profiles
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.user_strategies
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
```

O `active_session_token = null` é importante: sem isso, na próxima vez que ele logar, o polling detecta divergência e desloga de novo no meio do onboarding.

## Arquivos alterados

- `src/hooks/useUserProfile.ts`
  - Não rotacionar `active_session_token` enquanto `onboarding_completed=false`
  - Não iniciar polling enquanto `onboarding_completed=false`
  - `updateProfile` retorna erro estruturado em vez de `undefined` quando sessão inválida
  - Adiciona detecção de 401/PGRST116

- `src/pages/Onboarding.tsx`
  - `handleFinish`: re-checa sessão antes de salvar, usa upsert único, redireciona para `/auth` em 401, mostra mensagens específicas

## O que NÃO muda

- Edge functions (sem deploy de função)
- Modelos Gemini, prompts, schemas
- Lógica de pipeline (audience → visceral → matrix)
- Trava de integridade no `useUserProfile` (matriz < 28 → onboarding=false)
- Free tier, admin, Asaas

## Deploy

Frontend-only. Auto-deploy Vercel. Na VPS:

```bash
cd /root/app && git pull origin main
```

Sem `./scripts/deploy-selfhost.sh`. Mais o SQL acima rodado uma vez no Studio self-hosted pra destravar o `cakerollguide@gmail.com`.

## Resultado esperado

- O usuário não é mais deslogado no meio do onboarding
- O erro "Erro ao salvar perfil" deixa de ocorrer; se a sessão de fato expirar, ele é mandado para `/auth` com mensagem clara
- O `cakerollguide@gmail.com` volta ao onboarding limpo após o SQL
- O lock de single-session continua funcionando normalmente para usuários já no app

