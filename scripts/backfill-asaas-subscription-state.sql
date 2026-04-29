-- Backfill seguro: recupera asaas_subscription_id / asaas_customer_id
-- a partir dos webhooks Asaas já recebidos e auditados.
-- Rode no Supabase self-hosted (Studio SQL ou psql na VPS).

WITH candidates AS (
  SELECT DISTINCT ON (e.user_id)
    e.user_id,
    COALESCE(
      e.payload #>> '{payment,subscription}',
      e.payload #>> '{subscription,id}',
      e.payload #>> '{payment,subscriptionId}'
    ) AS asaas_subscription_id,
    COALESCE(
      e.payload #>> '{payment,customer}',
      e.payload #>> '{subscription,customer}'
    ) AS asaas_customer_id,
    CASE
      WHEN COALESCE((e.payload #>> '{payment,value}')::numeric, (e.payload #>> '{subscription,value}')::numeric, 0) >= 250 THEN 'annual'
      WHEN COALESCE((e.payload #>> '{payment,value}')::numeric, (e.payload #>> '{subscription,value}')::numeric, 0) >= 30 THEN 'monthly'
      ELSE NULL
    END AS inferred_plan,
    e.received_at
  FROM public.asaas_webhook_events e
  WHERE e.user_id IS NOT NULL
    AND COALESCE(
      e.payload #>> '{payment,subscription}',
      e.payload #>> '{subscription,id}',
      e.payload #>> '{payment,subscriptionId}'
    ) IS NOT NULL
  ORDER BY e.user_id, e.received_at DESC
)
UPDATE public.subscription_state s
SET
  asaas_subscription_id = COALESCE(s.asaas_subscription_id, c.asaas_subscription_id),
  asaas_customer_id = COALESCE(s.asaas_customer_id, c.asaas_customer_id),
  plan = COALESCE(s.plan, c.inferred_plan),
  updated_at = now()
FROM candidates c
WHERE s.user_id = c.user_id
  AND (
    s.asaas_subscription_id IS NULL
    OR s.asaas_customer_id IS NULL
    OR s.plan IS NULL
  )
RETURNING
  s.user_id,
  s.status,
  s.plan,
  s.asaas_subscription_id,
  s.asaas_customer_id,
  c.received_at AS source_event_received_at;
