# Liberar premium manual: carloshermesom@icloud.com

O backend é **self-hosted** (`api.influlab.pro`) — não consigo executar daqui. Você roda o SQL abaixo no **Studio self-hosted → SQL Editor**.

## Passo 1 — Diagnóstico (confirma se já é premium)

```sql
SELECT u.id, u.email, s.status, s.plan, s.current_period_end, s.asaas_customer_id, s.trial_ends_at
FROM auth.users u
LEFT JOIN public.subscription_state s ON s.user_id = u.id
WHERE u.email = 'carloshermesom@icloud.com';
```

Interpretação:
- `status = 'active'` → **já é premium**, problema é outro (cache do `useSubscription`, pedir pra ele dar refresh / logout-login). Pare aqui.
- `status = 'trial'` / `'past_due'` / `'canceled'` ou linha nula → seguir Passo 2.

## Passo 2 — Liberar como cortesia (sem Asaas)

Segue o padrão "premium manual da equipe" registrado na memória: `status='active'`, **sem** `asaas_customer_id` (pra ficar filtrável em auditoria de pagantes reais).

```sql
INSERT INTO public.subscription_state (user_id, status, plan, current_period_end, trial_ends_at)
SELECT u.id, 'active', 'annual', now() + interval '1 year', null
FROM auth.users u
WHERE u.email = 'carloshermesom@icloud.com'
ON CONFLICT (user_id) DO UPDATE
SET status = 'active',
    plan = COALESCE(public.subscription_state.plan, 'annual'),
    current_period_end = GREATEST(
      COALESCE(public.subscription_state.current_period_end, now()),
      now() + interval '1 year'
    ),
    updated_at = now();
```

Ajustes possíveis (me avise antes que eu reescrevo):
- Duração diferente de 1 ano → trocar `interval '1 year'`.
- Plano mensal → `plan = 'monthly'` + `interval '1 month'`.

## Passo 3 — Validar

```sql
SELECT email, status, plan, current_period_end
FROM auth.users u
JOIN public.subscription_state s ON s.user_id = u.id
WHERE u.email = 'carloshermesom@icloud.com';
```

Deve mostrar `status='active'`. Peça pro usuário **fazer logout e login de novo** (ou recarregar) — `useSubscription` cacheia em memória e só refaz a query no mount.

## Detalhes técnicos

- `useSubscription` (`src/hooks/useSubscription.ts`) lê `subscription_state` no mount. `isActive = status === 'active'` → libera `hasAccess` → `App.tsx` deixa de mostrar `<PaywallScreen />`.
- Sem `asaas_customer_id` o cron `apply-monthly-discounts` ignora, então cortesia não é cobrada.
- Nenhum arquivo do projeto muda. Só dados no DB self-hosted.

```text
auth.users ──┐
             ├─ subscription_state.status = 'active'  →  hasAccess=true  →  app libera
             └─ asaas_customer_id = NULL              →  fora da auditoria de pagantes
```
