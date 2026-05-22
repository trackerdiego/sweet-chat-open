## O que aconteceu

O erro confirma que a coluna `first_paid_at` ainda não existe na tabela `public.subscription_state` do Supabase self-hosted.

Isso não mexe em ciclo de cobrança, cancelamento, uso mensal, assinatura Asaas ou chargeback. Essa coluna foi criada apenas para uma finalidade isolada: controlar quando o presente/bônus da tela inicial libera as trends, contando 8 dias após o primeiro pagamento confirmado.

## Correção necessária

Rode primeiro este SQL no Studio do Supabase self-hosted:

```sql
ALTER TABLE public.subscription_state
ADD COLUMN IF NOT EXISTS first_paid_at timestamptz;
```

Depois rode este teste simples:

```sql
SELECT first_paid_at
FROM public.subscription_state
LIMIT 1;
```

Se esse SELECT não der erro, aí sim o backfill pode rodar.

## Backfill seguro depois da coluna existir

```sql
UPDATE public.subscription_state ss
SET first_paid_at = sub.first_paid
FROM (
  SELECT
    payload->'payment'->>'customer' AS asaas_customer_id,
    MIN(
      COALESCE(
        NULLIF(payload->'payment'->>'confirmedDate','')::timestamptz,
        NULLIF(payload->'payment'->>'paymentDate','')::timestamptz,
        NULLIF(payload->'payment'->>'clientPaymentDate','')::timestamptz,
        NULLIF(payload->'payment'->>'dateCreated','')::timestamptz,
        received_at
      )
    ) AS first_paid
  FROM public.asaas_webhook_events
  WHERE event_type = 'PAYMENT_RECEIVED'
    AND payload->'payment'->>'customer' IS NOT NULL
  GROUP BY payload->'payment'->>'customer'
) sub
WHERE ss.asaas_customer_id = sub.asaas_customer_id
  AND ss.first_paid_at IS NULL
  AND sub.first_paid IS NOT NULL;
```

## Fallback opcional para pagantes antigos sem webhook arquivado

```sql
UPDATE public.subscription_state
SET first_paid_at = COALESCE(current_period_end - INTERVAL '30 days', now() - INTERVAL '30 days')
WHERE first_paid_at IS NULL
  AND asaas_customer_id IS NOT NULL
  AND status = 'active';
```

## Auditoria final

```sql
SELECT
  COUNT(*) FILTER (WHERE first_paid_at IS NOT NULL) AS com_first_paid,
  COUNT(*) FILTER (WHERE first_paid_at IS NULL AND asaas_customer_id IS NOT NULL) AS pagantes_sem_data,
  COUNT(*) FILTER (WHERE asaas_customer_id IS NULL) AS sem_customer
FROM public.subscription_state;
```

## Bloco para VPS

Como o backend é self-hosted, depois que o SQL acima estiver aplicado, suba o código atualizado na VPS:

```bash
cd /root/app
git pull origin main
./scripts/deploy-selfhost.sh
```

Se quiser só reiniciar functions depois do pull:

```bash
cd ~/supabase/docker
docker compose restart functions
```