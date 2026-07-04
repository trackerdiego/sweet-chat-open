# Liberar 1 ano premium — thalysonpessoa75@gmail.com

Backend é **Supabase self-hosted em `api.influlab.pro`**. Rode no **SQL Editor do Studio self-hosted**. Migration Lovable não chega lá.

Ele já é pagante mensal (tem `asaas_customer_id` + `asaas_subscription_id`). A ideia é **NÃO mexer na assinatura Asaas dele** (senão o Asaas cobra de novo ou cancela errado). A gente só estende manualmente o `current_period_end` pra daqui 1 ano e garante `status='active'`. Quando ele quiser continuar depois, é só reativar cobrança normal.

## Passo 1 — Confirmar estado atual

```sql
select
  s.user_id,
  u.email,
  s.status,
  s.plan,
  s.current_period_end,
  s.first_paid_at,
  s.asaas_customer_id,
  s.asaas_subscription_id
from public.subscription_state s
join auth.users u on u.id = s.user_id
where u.email = 'thalysonpessoa75@gmail.com';
```

Confirma: existe linha, tem `asaas_customer_id`, status atual.

## Passo 2 — Cancelar a assinatura mensal no Asaas (manual, painel)

Pra ele **não ser cobrado no próximo ciclo**, cancele a subscription dele no painel Asaas (Assinaturas → buscar pelo email/customer_id → Cancelar).

Isso vai disparar webhook `SUBSCRIPTION_DELETED`, que hoje **não altera `subscription_state`** (webhook só reage a `PAYMENT_*`). Então o `status='active'` do passo 3 fica preservado. Se preferir, pode fazer o passo 3 **depois** do cancelamento por segurança.

## Passo 3 — Estender premium por 1 ano

```sql
update public.subscription_state
set
  status = 'active',
  plan = 'annual',
  current_period_end = now() + interval '1 year',
  first_paid_at = coalesce(first_paid_at, now()),
  updated_at = now()
where user_id = (select id from auth.users where email = 'thalysonpessoa75@gmail.com')
returning user_id, status, plan, current_period_end;
```

## Passo 4 — Validar

Peça pra ele dar F5 no app. `useSubscription` vai reler `subscription_state` e `hasAccess = (status === 'active')` fica true — libera tudo, `AccessGuard` não bloqueia mais.

## Notas técnicas

- **Não damos `is_premium=true` em outra tabela** porque o app usa `subscription_state.status` como fonte da verdade (`useSubscription.ts` + `AccessGuard.tsx`). Os 4 premium manuais da equipe seguem o mesmo padrão.
- **Não zeramos `asaas_customer_id`** — mantém histórico. Só cancelamos a subscription ativa no painel Asaas pra parar cobrança.
- Daqui a 1 ano, `current_period_end` vence mas hoje **não há cron que muda `status` pra `canceled` sozinho** — vai continuar `active` até você mexer. Se quiser expiração automática, é outra tarefa (posso adicionar depois).
- Alternativa: se preferir deixar a mensalidade rolando de graça, aplique cupom/desconto de 100% direto na subscription pelo painel Asaas em vez do passo 2. Mas o caminho acima é mais limpo.
