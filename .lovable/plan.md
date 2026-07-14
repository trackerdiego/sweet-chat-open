
# Liberar acesso full para `meduardamusa@gmail.com`

Como a usuária ainda **não criou conta**, precisamos de duas camadas pra garantir que ela nunca veja paywall — independente da ordem em que ela se cadastrar.

---

## 1. Frontend — whitelist de emails "cortesia"

Hoje `useSubscription.ts` tem um bypass hardcoded só pro admin (`agentevendeagente@gmail.com`). Vou transformar isso numa **lista** de emails com acesso liberado (mesmo comportamento do admin, mas sem virar admin do painel):

- Em `src/hooks/useSubscription.ts`:
  - Trocar `ADMIN_EMAIL` por dois arrays: `ADMIN_EMAILS` (mantém `agentevendeagente@gmail.com`) e `COMP_EMAILS` (novo, começa com `meduardamusa@gmail.com`).
  - Se `user.email ∈ ADMIN_EMAILS ∪ COMP_EMAILS` → setar `ADMIN_SUB` (status `active`) e sair sem consultar `subscription_state`. Só marca `isAdmin=true` pra ADMIN_EMAILS.
  - Efeito: assim que ela logar pela primeira vez, o `hasAccess` já é `true`, `AccessGuard` libera tudo, `AutoCheckoutOpener` e `PaywallScreen` não disparam.

Nenhuma outra mudança de UI ou lógica de assinatura.

## 2. Backend — SQL pra rodar no Studio self-hosted (`api.influlab.pro`)

Dois cenários cobertos no mesmo bloco:

**A) Se ela ainda NÃO criou conta** — o SQL não faz nada agora, mas o frontend já libera assim que ela logar. Rodar o bloco B depois só pra deixar registro persistente.

**B) Depois que ela criar conta (ou se já criou)** — inserir/atualizar `subscription_state` como `active` com validade longa, pra que mesmo sem o bypass do frontend ela passe:

```sql
-- Rodar no Studio self-hosted após ela criar a conta
WITH u AS (
  SELECT id FROM auth.users WHERE lower(email) = 'meduardamusa@gmail.com' LIMIT 1
)
INSERT INTO public.subscription_state (
  user_id, status, plan, current_period_end, trial_ends_at, first_paid_at, updated_at
)
SELECT id, 'active', 'annual', now() + interval '10 years', NULL, now(), now()
FROM u
ON CONFLICT (user_id) DO UPDATE
SET status = 'active',
    plan = COALESCE(public.subscription_state.plan, 'annual'),
    current_period_end = now() + interval '10 years',
    first_paid_at = COALESCE(public.subscription_state.first_paid_at, now()),
    updated_at = now();

-- Conferir
SELECT user_id, status, plan, current_period_end, asaas_customer_id
FROM public.subscription_state
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email)='meduardamusa@gmail.com');
```

Observação: `asaas_customer_id` fica `NULL` de propósito — mesmo padrão dos 4 premium manuais da equipe, então ela não polui auditoria de pagantes reais.

---

## Ordem sugerida

1. Aprovar este plano → aplico a mudança em `useSubscription.ts`.
2. Você manda o link/instrução pra ela criar conta normalmente.
3. Assim que ela criar, você roda o SQL do bloco acima no Studio (isso deixa persistente mesmo se um dia removermos o bypass do frontend).

## Detalhes técnicos

- Arquivo alterado: `src/hooks/useSubscription.ts` (só a checagem de email no topo de `fetch`).
- Nenhum edge function, nenhuma migration Lovable (backend é self-hosted).
- Reversão futura: remover o email de `COMP_EMAILS` e opcionalmente `UPDATE subscription_state SET status='canceled' WHERE user_id=...`.
