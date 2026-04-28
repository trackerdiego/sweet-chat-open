# Blindagem do Webhook Asaas — Execução Final

## Contexto
Já discutimos e validamos toda a arquitetura nas mensagens anteriores. Este plano é só para liberar a **execução** (escrita dos arquivos + bloco de deploy VPS), já que estou em modo Plan e preciso da sua aprovação formal pra mexer no código.

## O que vou fazer ao aprovar

### 1. Escrever a migration SQL
Arquivo: `supabase/migrations/<timestamp>_asaas_webhook_audit.sql`

Conteúdo:
- `CREATE TABLE public.asaas_webhook_events` (id, event_id UNIQUE, event_type, payload JSONB, received_at, processed_at, processing_error, user_id)
- Índices em `event_id`, `event_type`, `user_id`, `processed_at`
- RLS habilitado (só service_role lê/escreve)
- UPDATE manual no `subscription_state` do usuário `3308395e-6f0c-456b-ae01-4b3a3383614b` preenchendo `asaas_subscription_id = sub_5zto34l8dbtx6urs`, `asaas_customer_id = cus_000171803582`, `current_period_end`, `plan_type = 'monthly'`, `is_premium = true`
- INSERT dos 2 eventos históricos (`SUBSCRIPTION_CREATED` + `PAYMENT_RECEIVED`) na tabela de auditoria

> ⚠️ Lembrete crítico: como o backend é **self-hosted em api.influlab.pro**, esta migration NÃO roda automaticamente. Vou te entregar o SQL pronto pra colar no Studio self-hosted.

### 2. Reescrever `supabase/functions/asaas-webhook/index.ts`
Mudanças principais:
- **Log-first**: toda requisição grava em `asaas_webhook_events` ANTES de processar (idempotência via `event_id` UNIQUE)
- **Novos handlers**: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_DELETED`
- **Extração payload-first**: `syncSubscriptionState` lê IDs direto do `body.payment.subscription`, `body.payment.customer`, `body.subscription.id`, etc. — só chama API Asaas como último recurso
- **Helpers novos**: `inferPlanFromValue(value)` (47 → monthly, 297 → yearly), `addDaysISO(date, days)` pra calcular `current_period_end` quando API falha
- **Modo reprocess**: `POST /asaas-webhook` com header `x-cron-secret` + body `{ action: "reprocess", event_id: "..." }` reexecuta lógica em cima do payload salvo
- **Marca processado**: `UPDATE asaas_webhook_events SET processed_at = now()` no fim do fluxo bem-sucedido

### 3. Bloco de deploy pro VPS
Vou te entregar no fim da resposta o copia-e-cola padrão:

```bash
cd /root/app && git pull origin main && \
./scripts/deploy-selfhost.sh asaas-webhook
```

### 4. Query de auditoria
SQL extra pra você rodar no Studio depois e identificar outros usuários `is_premium = true` com `asaas_subscription_id IS NULL` (caso existam mais casos como esse).

## O que NÃO muda
- Lógica de coins/desconto mensal (`apply-monthly-discounts`) — intacta
- Webhook de `PAYMENT_RECEIVED` continua revertendo desconto via PATCH Asaas
- AccessGuard, useSubscription, paywall — nada alterado
- SMTP, templates de email — não tocados

## Riscos e mitigação
- **Risco**: tabela nova sem RLS adequada vaza payloads (têm CPF, email do cliente)
  - **Mitigação**: RLS só service_role, sem policy pública
- **Risco**: idempotência por `event_id` quebra se Asaas reenviar com ID diferente
  - **Mitigação**: já é o comportamento atual; `event_id` é estável por evento no Asaas
- **Risco**: deploy quebra webhook em produção
  - **Mitigação**: função mantém retrocompatibilidade total com payloads antigos; reprocess permite refazer manualmente se algo falhar

---

**Clica em "Approve plan" abaixo** que eu já escrevo tudo e te mando o bloco do VPS na mesma resposta. 🚀