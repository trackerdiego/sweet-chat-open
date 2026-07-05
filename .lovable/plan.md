# Fix: Maria Oziene (oseaniavelino@gmail.com) presa no paywall

> ⚠️ No Studio SQL Editor, cole **apenas o SQL** (o que está dentro dos blocos `sql`). Não cole títulos com `#`, nem as crases ``` ```, nem comentários em português fora do bloco — isso não é SQL válido.

## Passo 1 — Diagnóstico

Cole no SQL Editor (as duas queries podem ir juntas):

```sql
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

select event_id, event_type, received_at, processed_at, error,
       payload->'payment'->>'status'       as pay_status,
       payload->'payment'->>'value'        as value,
       payload->'payment'->>'billingType'  as billing
from public.asaas_webhook_events
where payload::text ilike '%oseaniavelino%'
   or payload::text ilike '%oziene%'
order by received_at desc
limit 20;
```

Cenários:
- **A) Pagamento avulso antigo** — não tem `asaas_subscription_id`, mas pagou. → Passo 2A.
- **B) Assinatura existe, webhook falhou** — tem `asaas_subscription_id` mas `status != active`. → Passo 2B.
- **C) Sem eventos Asaas** — não pagou de verdade. Nenhum fix.

## Passo 2A — Fix manual (avulso antigo)

```sql
update public.subscription_state
set status = 'active',
    plan = coalesce(plan, 'annual'),
    current_period_end = greatest(coalesce(current_period_end, now()), now() + interval '10 years'),
    first_paid_at = coalesce(first_paid_at, now()),
    updated_at = now()
where user_id = (select id from auth.users where lower(email) = 'oseaniavelino@gmail.com');
```

Se a linha não existir:

```sql
insert into public.subscription_state (user_id, status, plan, current_period_end, first_paid_at)
select id, 'active', 'annual', now() + interval '10 years', now()
from auth.users where lower(email) = 'oseaniavelino@gmail.com'
on conflict (user_id) do nothing;
```

## Passo 2B — Reprocessar evento Asaas

Pega o `event_id` mais recente com `pay_status = CONFIRMED/RECEIVED` do Passo 1 e roda no terminal da VPS:

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

Peça pra ela deslogar e logar de novo — `useSubscription` refaz o fetch e o paywall libera.

## Nenhuma alteração de código

Só operação de dados no self-hosted.
