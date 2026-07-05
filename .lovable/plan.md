# Fix: Maria Oziene (oseaniavelino@gmail.com) presa no paywall

Mesmo padrão do caso anterior: cliente com pagamento OK sendo mandada pro checkout. O paywall (`AccessGuard` + `useSubscription`) só libera quando `subscription_state.status = 'active'`. Se a linha dela estiver como `trial` (expirado), `past_due` ou `canceled` — ou se nem existir — o app trava.

Como o backend é self-hosted (`api.influlab.pro`), daqui não consigo consultar. Você roda os SQLs abaixo no Studio self-hosted.

## Passo 1 — Diagnóstico

Rode no SQL Editor do Studio self-hosted:

```sql
-- Achar user + estado atual
select
  u.id as user_id,
  u.email,
  u.created_at as signup_at,
  s.status,
  s.plan,
  s.trial_ends_at,
  s.current_period_end,
  s.first_paid_at,
  s.asaas_customer_id,
  s.asaas_subscription_id,
  s.next_invoice->>'due_date' as next_due,
  s.updated_at
from auth.users u
left join public.subscription_state s on s.user_id = u.id
where lower(u.email) = 'oseaniavelino@gmail.com';

-- Eventos Asaas recebidos pra ela (se existir customer_id, filtrar por ele; senão por email do payload)
select event_id, event_type, received_at, processed_at, error, payload->'payment'->>'status' as pay_status,
       payload->'payment'->>'value' as value, payload->'payment'->>'billingType' as billing
from public.asaas_webhook_events
where payload::text ilike '%oseaniavelino%'
   or payload::text ilike '%oziene%'
order by received_at desc
limit 20;
```

Cenários possíveis:

- **A) Pagamento antigo avulso (pré-assinaturas)** — igual ao caso anterior. Não tem `asaas_subscription_id`, mas ela pagou. → aplicar fix manual (Passo 2A).
- **B) Assinatura existe, webhook falhou** — tem `asaas_subscription_id` mas `status != active`. Vê no `asaas_webhook_events` se chegou `PAYMENT_RECEIVED/CONFIRMED` e reprocessa via `admin-reprocess-asaas-event` (Passo 2B).
- **C) Trial expirado sem pagamento real** — sem eventos Asaas confirmados. Aí é caso genuíno de não-pagante, não fix.

## Passo 2A — Fix manual (pagamento avulso antigo)

Concede acesso vitalício (ou por período longo) mantendo rastro:

```sql
update public.subscription_state
set status = 'active',
    plan = coalesce(plan, 'annual'),
    current_period_end = greatest(coalesce(current_period_end, now()), now() + interval '10 years'),
    first_paid_at = coalesce(first_paid_at, now()),
    updated_at = now()
where user_id = (select id from auth.users where lower(email) = 'oseaniavelino@gmail.com');
```

Se a linha não existir (raro, mas o `handle_new_user` pode ter falhado):

```sql
insert into public.subscription_state (user_id, status, plan, current_period_end, first_paid_at)
select id, 'active', 'annual', now() + interval '10 years', now()
from auth.users where lower(email) = 'oseaniavelino@gmail.com'
on conflict (user_id) do nothing;
```

## Passo 2B — Reprocessar evento Asaas (se caso B)

Pega o `event_id` mais recente de PAYMENT_RECEIVED/CONFIRMED do Passo 1 e chama:

```bash
curl -X POST https://api.influlab.pro/functions/v1/admin-reprocess-asaas-event \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"COLE_AQUI"}'
```

## Passo 3 — Validar

```sql
select user_id, status, plan, current_period_end
from public.subscription_state
where user_id = (select id from auth.users where lower(email) = 'oseaniavelino@gmail.com');
```

Peça pra ela **deslogar e logar de novo** (força refetch do `useSubscription`). Deve cair direto no app sem paywall.

## Nenhuma alteração de código

Só operação de dados no self-hosted. Nenhum arquivo do repositório muda.
