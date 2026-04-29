#!/usr/bin/env bash
# ============================================================================
# simulate-asaas-webhook.sh
# ----------------------------------------------------------------------------
# Simula cargas reais do webhook Asaas em um user_id de teste, validando
# cada efeito no DB (subscription_state, user_usage, asaas_webhook_events)
# e oferecendo cleanup automático no fim.
#
# USO:
#   ./scripts/simulate-asaas-webhook.sh --user-id <UUID> [--scenario all|created|cycle|overdue] [--cleanup]
#
# REQUISITOS (rodar na VPS self-hosted):
#   - ~/supabase/docker/.env com ASAAS_WEBHOOK_TOKEN
#   - docker compose + curl + jq instalados
#
# LIMITAÇÕES CONHECIDAS:
#   - pix_qr_code virá NULL (payment.id é fake → fetchPixQrCode 404). Não é bug.
#   - revertSubscriptionValueIfDiscounted vai logar erro silencioso. Não quebra.
#   - Pra QR Pix real e end-to-end 100%, use Asaas sandbox.
# ============================================================================

set -euo pipefail

# ---------- Config ----------
WEBHOOK_URL="https://api.influlab.pro/functions/v1/asaas-webhook"
ENV_FILE="${HOME}/supabase/docker/.env"
SCENARIO="all"
USER_ID=""
DO_CLEANUP_ONLY=false

# ---------- Cores ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# ---------- Args ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user-id) USER_ID="$2"; shift 2 ;;
    --scenario) SCENARIO="$2"; shift 2 ;;
    --cleanup) DO_CLEANUP_ONLY=true; shift ;;
    -h|--help)
      grep '^#' "$0" | head -n 25; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$USER_ID" ]]; then
  echo -e "${RED}--user-id é obrigatório${NC}"
  exit 1
fi

# UUID format check
if ! [[ "$USER_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo -e "${RED}--user-id inválido (precisa ser UUID)${NC}"
  exit 1
fi

# ---------- Carrega secrets do .env ----------
if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}.env não encontrado em $ENV_FILE${NC}"
  exit 1
fi
ASAAS_WEBHOOK_TOKEN=$(grep -E '^ASAAS_WEBHOOK_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [[ -z "$ASAAS_WEBHOOK_TOKEN" ]]; then
  echo -e "${RED}ASAAS_WEBHOOK_TOKEN não encontrado em $ENV_FILE${NC}"; exit 1
fi

# Conexão ao Postgres pelo container self-hosted (evita pooler/porta local errada)
export RESEND_API_KEY="${RESEND_API_KEY:-dummy}"
PSQL="docker compose -f /root/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres -tAX"

# ---------- Helpers ----------
ts_ns() { date +%s%N; }

snapshot() {
  local label="$1"
  echo -e "${BLUE}--- snapshot ${label} ---${NC}"
  $PSQL -c "
    SELECT json_build_object(
      'is_premium', (SELECT is_premium FROM public.user_usage WHERE user_id = '$USER_ID'),
      'status', (SELECT status FROM public.subscription_state WHERE user_id = '$USER_ID'),
      'plan', (SELECT plan FROM public.subscription_state WHERE user_id = '$USER_ID'),
      'asaas_subscription_id', (SELECT asaas_subscription_id FROM public.subscription_state WHERE user_id = '$USER_ID'),
      'current_period_end', (SELECT current_period_end FROM public.subscription_state WHERE user_id = '$USER_ID'),
      'next_invoice_present', (SELECT (next_invoice IS NOT NULL) FROM public.subscription_state WHERE user_id = '$USER_ID'),
      'next_invoice_due', (SELECT next_invoice->>'due_date' FROM public.subscription_state WHERE user_id = '$USER_ID')
    );" | jq -C .
}

assert() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo -e "      ${GREEN}✓${NC} $label = $actual"
  else
    echo -e "      ${RED}✗${NC} $label: esperado [$expected], obtido [$actual]"
  fi
}

# Query helpers
q_is_premium()   { $PSQL -c "SELECT COALESCE(is_premium::text,'null') FROM public.user_usage WHERE user_id='$USER_ID';"; }
q_sub_status()   { $PSQL -c "SELECT COALESCE(status,'null') FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_sub_plan()     { $PSQL -c "SELECT COALESCE(plan,'null') FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_sub_asaas_id() { $PSQL -c "SELECT COALESCE(asaas_subscription_id,'null') FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_sub_customer_id() { $PSQL -c "SELECT COALESCE(asaas_customer_id,'null') FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_next_inv()     { $PSQL -c "SELECT CASE WHEN next_invoice IS NULL THEN 'null' ELSE 'present' END FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_next_inv_sub_id() { $PSQL -c "SELECT COALESCE(next_invoice->>'asaas_subscription_id','null') FROM public.subscription_state WHERE user_id='$USER_ID';"; }
q_event_state()  {
  local eid="$1"
  $PSQL -c "SELECT json_build_object('processed', processed_at IS NOT NULL, 'error', processing_error) FROM public.asaas_webhook_events WHERE event_id='$eid';"
}

send_event() {
  local label="$1" payload="$2"
  echo -e "${YELLOW}>>> $label${NC}"
  local resp http_code body
  resp=$(curl -sS -o /tmp/sim-resp.json -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
    -d "$payload")
  http_code="$resp"
  body=$(cat /tmp/sim-resp.json)
  echo "      HTTP $http_code → $body"
  if [[ "$http_code" != "200" ]]; then
    echo -e "      ${RED}✗ webhook não retornou 200${NC}"
    return 1
  fi
  return 0
}

# ---------- Payload builders ----------
mk_payment_created() {
  local eid="$1" pid="$2" sid="$3" value="$4" due="$5"
  cat <<JSON
{
  "id": "$eid",
  "event": "PAYMENT_CREATED",
  "payment": {
    "id": "$pid",
    "externalReference": "$USER_ID",
    "subscription": "$sid",
    "customer": "cus_sim_$USER_ID",
    "billingType": "PIX",
    "value": $value,
    "dueDate": "$due",
    "status": "PENDING",
    "invoiceUrl": "https://www.asaas.com/i/$pid"
  }
}
JSON
}

mk_payment_received() {
  local eid="$1" pid="$2" sid="$3" value="$4" due="$5"
  cat <<JSON
{
  "id": "$eid",
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "$pid",
    "externalReference": "$USER_ID",
    "subscription": "$sid",
    "customer": "cus_sim_$USER_ID",
    "billingType": "PIX",
    "value": $value,
    "dueDate": "$due",
    "status": "RECEIVED"
  }
}
JSON
}

mk_payment_overdue() {
  local eid="$1" pid="$2" sid="$3"
  cat <<JSON
{
  "id": "$eid",
  "event": "PAYMENT_OVERDUE",
  "payment": {
    "id": "$pid",
    "externalReference": "$USER_ID",
    "subscription": "$sid",
    "customer": "cus_sim_$USER_ID",
    "billingType": "PIX",
    "value": 47,
    "status": "OVERDUE"
  }
}
JSON
}

mk_subscription_created() {
  local eid="$1" sid="$2" cycle="$3" value="$4" next_due="$5"
  cat <<JSON
{
  "id": "$eid",
  "event": "SUBSCRIPTION_CREATED",
  "subscription": {
    "id": "$sid",
    "externalReference": "$USER_ID",
    "customer": "cus_sim_$USER_ID",
    "cycle": "$cycle",
    "value": $value,
    "nextDueDate": "$next_due",
    "status": "ACTIVE"
  }
}
JSON
}

mk_subscription_deleted() {
  local eid="$1" sid="$2"
  cat <<JSON
{
  "id": "$eid",
  "event": "SUBSCRIPTION_DELETED",
  "subscription": {
    "id": "$sid",
    "externalReference": "$USER_ID",
    "customer": "cus_sim_$USER_ID",
    "status": "INACTIVE"
  }
}
JSON
}

# ---------- Cenários ----------
scenario_created() {
  echo -e "\n${BLUE}=== CENÁRIO: created ===${NC}"
  snapshot "BEFORE"

  local TS; TS=$(ts_ns)
  local EID="evt_sim_${TS}_created"
  local PID="pay_sim_${TS}"
  local SID="sub_sim_${TS}"
  local DUE; DUE=$(date -u -d "+5 days" +%Y-%m-%d)

  send_event "[1/2] PAYMENT_CREATED (Pix R\$47, vence $DUE)" \
    "$(mk_payment_created "$EID" "$PID" "$SID" 47 "$DUE")"
  sleep 1
  assert "asaas_subscription_id" "$SID" "$(q_sub_asaas_id)"
  assert "asaas_customer_id" "cus_sim_$USER_ID" "$(q_sub_customer_id)"
  assert "next_invoice present" "present" "$(q_next_inv)"
  assert "next_invoice.asaas_subscription_id" "$SID" "$(q_next_inv_sub_id)"
  assert "event processed" "true" "$($PSQL -c "SELECT (processed_at IS NOT NULL)::text FROM public.asaas_webhook_events WHERE event_id='$EID';")"

  send_event "[2/2] mesmo PAYMENT_CREATED (idempotência)" \
    "$(mk_payment_created "$EID" "$PID" "$SID" 47 "$DUE")"
  if grep -q '"deduped":true' /tmp/sim-resp.json; then
    echo -e "      ${GREEN}✓${NC} dedupe OK"
  else
    echo -e "      ${RED}✗${NC} esperava deduped:true"
  fi

  snapshot "AFTER"
}

scenario_cycle() {
  echo -e "\n${BLUE}=== CENÁRIO: cycle ===${NC}"
  snapshot "BEFORE"

  local TS; TS=$(ts_ns)
  local SID="sub_sim_${TS}"
  local PID1="pay_sim_${TS}_1"
  local PID2="pay_sim_${TS}_2"
  local DUE1; DUE1=$(date -u -d "+5 days" +%Y-%m-%d)
  local DUE2; DUE2=$(date -u -d "+35 days" +%Y-%m-%d)
  local NEXT_DUE; NEXT_DUE=$(date -u -d "+30 days" +%Y-%m-%d)

  send_event "[1/4] SUBSCRIPTION_CREATED (MONTHLY R\$47, ACTIVE)" \
    "$(mk_subscription_created "evt_sim_${TS}_subc" "$SID" "MONTHLY" 47 "$NEXT_DUE")"
  sleep 1
  assert "asaas_subscription_id" "$SID" "$(q_sub_asaas_id)"
  assert "plan" "monthly" "$(q_sub_plan)"
  assert "status" "active" "$(q_sub_status)"

  send_event "[2/4] PAYMENT_CREATED (1ª fatura, vence $DUE1)" \
    "$(mk_payment_created "evt_sim_${TS}_pc1" "$PID1" "$SID" 47 "$DUE1")"
  sleep 1
  assert "next_invoice present" "present" "$(q_next_inv)"

  send_event "[3/4] PAYMENT_RECEIVED (1ª fatura paga)" \
    "$(mk_payment_received "evt_sim_${TS}_pr1" "$PID1" "$SID" 47 "$DUE1")"
  sleep 1
  assert "is_premium" "t" "$(q_is_premium)"
  assert "next_invoice limpa" "null" "$(q_next_inv)"
  assert "status" "active" "$(q_sub_status)"

  send_event "[4/4] PAYMENT_CREATED (próximo mês, vence $DUE2)" \
    "$(mk_payment_created "evt_sim_${TS}_pc2" "$PID2" "$SID" 47 "$DUE2")"
  sleep 1
  assert "next_invoice repopulado" "present" "$(q_next_inv)"

  snapshot "AFTER"
}

scenario_overdue() {
  echo -e "\n${BLUE}=== CENÁRIO: overdue ===${NC}"
  snapshot "BEFORE"

  local TS; TS=$(ts_ns)
  local SID="sub_sim_${TS}"
  local PID="pay_sim_${TS}"
  local DUE; DUE=$(date -u -d "+1 days" +%Y-%m-%d)

  send_event "[1/3] PAYMENT_CREATED" \
    "$(mk_payment_created "evt_sim_${TS}_pc" "$PID" "$SID" 47 "$DUE")"
  sleep 1
  assert "next_invoice present" "present" "$(q_next_inv)"

  send_event "[2/3] PAYMENT_OVERDUE" \
    "$(mk_payment_overdue "evt_sim_${TS}_po" "$PID" "$SID")"
  sleep 1
  assert "is_premium" "f" "$(q_is_premium)"
  assert "status" "past_due" "$(q_sub_status)"
  assert "next_invoice mantido" "present" "$(q_next_inv)"

  send_event "[3/3] SUBSCRIPTION_DELETED" \
    "$(mk_subscription_deleted "evt_sim_${TS}_sd" "$SID")"
  sleep 1
  assert "status" "canceled" "$(q_sub_status)"

  snapshot "AFTER"
}

cleanup() {
  echo -e "\n${YELLOW}=== CLEANUP para user $USER_ID ===${NC}"
  echo -e "${RED}ATENÇÃO:${NC} vai resetar subscription_state, user_usage e deletar eventos evt_sim_*"
  read -rp "Confirma? [y/N] " ans
  if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
    echo "Cleanup abortado."
    return
  fi

  $PSQL -c "
    UPDATE public.subscription_state
    SET next_invoice = NULL,
        status = 'trial',
        asaas_subscription_id = NULL,
        current_period_end = NULL,
        plan = NULL,
        updated_at = now()
    WHERE user_id = '$USER_ID';

    UPDATE public.user_usage SET is_premium = false WHERE user_id = '$USER_ID';

    DELETE FROM public.asaas_webhook_events
    WHERE event_id LIKE 'evt_sim_%' AND (user_id = '$USER_ID' OR user_id IS NULL);
  " > /dev/null
  echo -e "${GREEN}Cleanup feito.${NC}"
  snapshot "POST-CLEANUP"
}

# ---------- Main ----------
echo -e "${BLUE}user_id:${NC} $USER_ID"
echo -e "${BLUE}webhook:${NC} $WEBHOOK_URL"
echo -e "${BLUE}cenário:${NC} $SCENARIO"

if $DO_CLEANUP_ONLY; then
  cleanup
  exit 0
fi

# Sanity: user_id existe?
exists=$($PSQL -c "SELECT EXISTS(SELECT 1 FROM auth.users WHERE id='$USER_ID')::text;")
if [[ "$exists" != "t" ]]; then
  echo -e "${RED}user_id não existe em auth.users${NC}"; exit 1
fi

case "$SCENARIO" in
  created) scenario_created ;;
  cycle)   scenario_cycle ;;
  overdue) scenario_overdue ;;
  all)
    scenario_created
    cleanup
    scenario_cycle
    cleanup
    scenario_overdue
    ;;
  *) echo -e "${RED}cenário inválido: $SCENARIO${NC}"; exit 1 ;;
esac

cleanup
echo -e "\n${GREEN}=== FIM ===${NC}"
