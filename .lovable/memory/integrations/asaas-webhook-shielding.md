---
name: Asaas Webhook Shielding
description: Audit table asaas_webhook_events + log-first webhook + reprocess mode. Como auditar e recuperar eventos perdidos
type: feature
---

# Blindagem Webhook Asaas (28-abr-2026)

## Por que existe
Bug original: webhook dependia 100% da API Asaas pra preencher `subscription_state`. Quando API falhava, pagante ficava com `asaas_subscription_id=NULL` e `current_period_end=NULL` mesmo com `is_premium=true`. Usuário `3308395e-6f0c-456b-ae01-4b3a3383614b` foi vítima disso.

## Arquitetura
1. **Tabela `public.asaas_webhook_events`** (audit + idempotência): toda requisição grava payload bruto ANTES de processar. Idempotência via `event_id` UNIQUE. RLS só service_role.
2. **`asaas-webhook` payload-first**: extrai `subscription_id`, `customer_id`, `value`, `cycle`, `nextDueDate` direto do `body.subscription` ou `body.payment` ANTES de chamar API Asaas. Fallbacks: `inferPlanFromValue(47→monthly, 297→yearly)` e `addDaysISO()` pra calcular `current_period_end`.
3. **Modo reprocess**: `POST /asaas-webhook` com header `x-cron-secret` + body `{action:"reprocess", event_id:"..."}` reexecuta lógica em cima do payload salvo. Usado pra recuperar eventos que falharam.
4. **Novos handlers**: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_DELETED` além de `PAYMENT_*`.

## Como auditar (Studio SQL)
```sql
-- Pagantes órfãos (excluindo equipe = sem asaas_customer_id)
SELECT uu.user_id, ss.asaas_subscription_id, ss.current_period_end
FROM public.user_usage uu
LEFT JOIN public.subscription_state ss ON ss.user_id = uu.user_id
WHERE uu.is_premium = true
  AND ss.asaas_customer_id IS NOT NULL
  AND (ss.asaas_subscription_id IS NULL OR ss.current_period_end IS NULL);

-- Eventos com erro de processamento ou parados
SELECT event_id, event_type, processing_error, received_at
FROM public.asaas_webhook_events
WHERE processing_error IS NOT NULL OR processed_at IS NULL
ORDER BY received_at DESC LIMIT 20;
```

## Como reprocessar evento (VPS)
```bash
export CRON_SECRET=$(grep ^CRON_SECRET ~/supabase/docker/.env | cut -d= -f2)
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"reprocess","event_id":"<event_id>"}'
```
Esperado: HTTP 200 + `{"reprocessed":true,"userId":"..."}`.

## Membros da equipe (premium manual)
4 user_ids têm `is_premium=true` mas SEM `asaas_customer_id` — são manuais, não passam pelo webhook. SEMPRE filtrar `asaas_customer_id IS NOT NULL` em queries de auditoria de pagantes.
