

# Plano: corrigir estado inconsistente do usuário cakerollguide@gmail.com + prevenir reincidência

## Diagnóstico

O usuário ficou em estado inconsistente:
- `onboarding_completed = true` no `user_profiles`
- Mas `user_strategies` vazio (matriz nunca gerou)
- E provavelmente `audience_profiles` incompleto também

Isso aconteceu porque uma versão anterior do `Onboarding.tsx` (a do "fire-and-forget") marcava `onboarding_completed = true` antes da geração terminar. Quando a geração falhava em background, o usuário ficava preso: o app não redireciona pra `/onboarding` (porque o flag está true) mas também não tem matriz personalizada.

## Correção em 2 partes

### Parte 1 — Resetar o estado do usuário específico

SQL para rodar no Studio self-hosted (`api.influlab.pro`), porque o backend é self-hosted e migrations Lovable não chegam lá:

```sql
-- Reset onboarding do usuário cakerollguide@gmail.com
update public.user_profiles
set 
  onboarding_completed = false,
  description_status = 'pending'
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);

-- Limpa estudo de público parcial (se houver)
delete from public.audience_profiles
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);

-- Limpa qualquer matriz parcial (se houver)
delete from public.user_strategies
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);
```

Depois disso, no próximo login ele será redirecionado pra `/onboarding` automaticamente (a lógica de redirect já existe baseada em `onboarding_completed`).

### Parte 2 — Prevenir que isso aconteça de novo

A versão atual do `Onboarding.tsx` (após o último deploy) já faz isso parcialmente: ela só marca `onboarding_completed = true` no `handleFinish()`, **antes** de iniciar o pipeline visível de 3 etapas. Se o usuário fechar a aba durante o pipeline, ele já entra com flag true mas matriz incompleta — mesmo bug.

**Correção no fluxo:** mover o `onboarding_completed = true` para **depois** das 3 etapas terem sucesso. Especificamente:

1. No `handleFinish()`: salva apenas `display_name`, `primary_niche`, `content_style`, `description_status`, **mas não** `onboarding_completed`
2. No final de `runPipeline()`, quando todas as 3 etapas chegam em `done`: aí sim faz um update marcando `onboarding_completed = true`
3. No fallback `skipPipeline()` (botão "Continuar mesmo assim" após 2 retries falharem): também marca `onboarding_completed = true` aí, porque é decisão consciente do usuário

Resultado: se o usuário fechar a aba no meio, próximo login volta pro `/onboarding` e o resume detecta as etapas já feitas (audience/avatar/matrix) e pula direto pra que falta.

### Arquivo tocado

- `src/pages/Onboarding.tsx` — mover o `onboarding_completed: true` do payload inicial pra um update separado ao final do pipeline + ao final do skip

### Deploy

- **Frontend:** auto-deploy Vercel (sem ação manual)
- **Backend:** rodar o SQL acima no Studio self-hosted (`https://studio.influlab.pro` ou interface equivalente). Sem `./scripts/deploy-selfhost.sh` necessário porque nenhuma edge function muda

### Bloco copia-e-cola pra você executar

**No Studio self-hosted, SQL Editor:**

```sql
update public.user_profiles
set onboarding_completed = false, description_status = 'pending'
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.audience_profiles
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');

delete from public.user_strategies
where user_id = (select id from auth.users where email = 'cakerollguide@gmail.com');
```

**Na VPS:** nada. Frontend Vercel cuida do resto.

