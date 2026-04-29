## Objetivo
Criar um script único na VPS pra simular cargas reais do webhook Asaas em um user_id de teste, validar cada efeito no DB, e limpar o estado no fim. Cobre os 3 cenários do ciclo de vida da assinatura.

## O que o script faz

`scripts/simulate-asaas-webhook.sh` — bash interativo, roda na VPS contra `https://api.influlab.pro/functions/v1/asaas-webhook`.

### Argumentos
```
./scripts/simulate-asaas-webhook.sh --user-id <UUID> [--scenario all|created|cycle|overdue] [--cleanup]
```
- `--user-id` (obrigatório): UUID do user de teste que você vai me passar
- `--scenario` (default `all`): qual cenário rodar
- `--cleanup`: só roda a limpeza, sem disparar evento

### Cenários

**1. `created` — popular fatura pendente**
Dispara `PAYMENT_CREATED` (Pix, R$47, vence em 5 dias). Valida:
- HTTP 200 `{"received":true}`
- `asaas_webhook_events` tem o event_id, `processed_at` preenchido, `processing_error` NULL
- `subscription_state.next_invoice` populado com `asaas_payment_id`, `due_date`, `pix_qr_code` (NULL ok — payment_id é fake), `is_paid:false`, `notifications_sent:{d3:false,d1:false,d0:false}`

Repete o mesmo evento → espera `{"received":true,"deduped":true}` (idempotência).

**2. `cycle` — ciclo completo**
Sequência:
1. `SUBSCRIPTION_CREATED` (cycle MONTHLY, value 47, ACTIVE) → valida `subscription_state.asaas_subscription_id`, `plan='monthly'`, `status='active'`, `current_period_end` preenchido
2. `PAYMENT_CREATED` → valida `next_invoice` populado
3. `PAYMENT_RECEIVED` (mesmo payment.id do passo 2) → valida:
   - `user_usage.is_premium = true`
   - `subscription_state.next_invoice = NULL` (limpa)
   - `subscription_state.status = 'active'`
4. Novo `PAYMENT_CREATED` (próximo mês, due_date +30d) → valida `next_invoice` populado de novo

**3. `overdue` — inadimplência**
1. `PAYMENT_CREATED` 
2. `PAYMENT_OVERDUE` → valida `user_usage.is_premium = false`, `next_invoice` MANTIDO (cliente ainda pode pagar), `status='past_due'`
3. `SUBSCRIPTION_DELETED` → valida `status='canceled'`

### Estado salvo + Snapshot before/after

Antes de cada cenário, script faz `SELECT` no `psql` e salva snapshot em `/tmp/sim-snapshot-before.json`. Depois faz query igual e gera diff visível no terminal (campos: `is_premium`, `status`, `plan`, `current_period_end`, `next_invoice IS NULL`, `asaas_subscription_id`).

### Cleanup automático (rodado no fim de cada execução, ou via `--cleanup` standalone)
```sql
UPDATE subscription_state 
SET next_invoice = NULL, status = 'trial', asaas_subscription_id = NULL, current_period_end = NULL
WHERE user_id = '<UUID>';

UPDATE user_usage SET is_premium = false WHERE user_id = '<UUID>';

DELETE FROM asaas_webhook_events WHERE event_id LIKE 'evt_sim_%' AND user_id = '<UUID>';
```

Pede confirmação `[y/N]` antes de deletar — protege contra rodar acidentalmente em user real.

## Detalhes técnicos

### Autenticação
Lê `ASAAS_WEBHOOK_TOKEN` direto de `~/supabase/docker/.env` e envia no header `asaas-access-token`. Mesma forma que Asaas faz.

### IDs únicos
Cada evento usa `evt_sim_$(date +%s%N)` e `pay_sim_$(date +%s%N)` — garante que rerun não colide com eventos antigos.

### Validações via psql
Script usa `psql "$SUPABASE_DB_URL"` (já está no `.env` do user na VPS) com queries scoped por `user_id`. Output em JSON pra facilitar diff.

### Estrutura do payload
Idêntica ao que Asaas envia em produção (campos em camelCase, `externalReference` no payment, `subscription` como string id, etc) — bate com o que `resolvePaymentContext()` e `resolveSubscriptionContext()` esperam em `asaas-webhook/index.ts`.

### Limitações documentadas no header do script
- `pix_qr_code` virá NULL porque `payment.id` é fake → `fetchPixQrCode()` retorna 404 da API Asaas (esperado, não é bug)
- `revertSubscriptionValueIfDiscounted` vai logar erro se rodar com `asaas_subscription_id` fake — silencioso, não quebra o fluxo
- Pra QR Pix real e fluxo end-to-end 100%, precisa Asaas sandbox

## Output esperado no terminal

```
=== CENÁRIO: cycle ===
[1/4] SUBSCRIPTION_CREATED... HTTP 200 ✓
      → asaas_subscription_id: sub_sim_172... ✓
      → plan: monthly ✓
[2/4] PAYMENT_CREATED... HTTP 200 ✓
      → next_invoice populado, due_date 2026-05-04 ✓
[3/4] PAYMENT_RECEIVED... HTTP 200 ✓
      → is_premium: false → true ✓
      → next_invoice: object → NULL ✓
[4/4] PAYMENT_CREATED (próximo mês)... HTTP 200 ✓
      → next_invoice repopulado, due_date 2026-06-04 ✓

Cleanup? [y/N]
```

## Bloco copia-e-cola pra VPS (entregue no fim da execução)
```bash
cd /root/app && git pull
chmod +x scripts/simulate-asaas-webhook.sh
./scripts/simulate-asaas-webhook.sh --user-id <SEU_USER_ID> --scenario all
```

Não mexe em código de produção, não muda schema, não precisa redeploy de function.