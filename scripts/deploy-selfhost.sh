#!/usr/bin/env bash
# Deploy de todas as edge functions pro Supabase self-hosted (api.influlab.pro)
#
# Dois modos automáticos:
#
# 1. MODO CLI (preferido)
#    Requer: SUPABASE_ACCESS_TOKEN + PROJECT_REF
#    Usa: supabase functions deploy
#
# 2. MODO DOCKER FALLBACK (auto, sem token)
#    Detecta o stack supabase/docker local, sincroniza supabase/functions
#    pro volume do container `functions` e faz restart.
#
# Uso típico na VPS:
#   cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
#
# Flags:
#   --secrets   (modo CLI) cadastra secrets antes do deploy
#   --force-docker   força modo docker mesmo com token presente

set -euo pipefail

PUBLIC_FNS=(
  asaas-webhook
  send-push
  scheduled-push
  process-email-queue
  auth-email-hook
)

PRIVATE_FNS=(
  ai-chat
  generate-script
  generate-tools-content
  generate-daily-guide
  start-tools-job
  start-script-job
  start-daily-guide-job
  start-transcription-job
  get-ai-job-status
  generate-audience-profile
  generate-personalized-matrix
  start-onboarding-run
  get-onboarding-run-status
  transcribe-media
  admin-dashboard
  create-asaas-subscription
  award-task-coins
  register-referral
)

ALL_FNS=("${PUBLIC_FNS[@]}" "${PRIVATE_FNS[@]}")

VALIDATE_FNS=(
  start-tools-job
  start-script-job
  start-daily-guide-job
  start-transcription-job
  get-ai-job-status
  start-onboarding-run
  get-onboarding-run-status
  generate-audience-profile
  generate-personalized-matrix
)

SELFHOST_BASE_URL="${SELFHOST_BASE_URL:-https://api.influlab.pro}"

WANT_SECRETS=false
FORCE_DOCKER=false
REQUESTED_FNS=()
for arg in "$@"; do
  case "$arg" in
    --secrets) WANT_SECRETS=true ;;
    --force-docker) FORCE_DOCKER=true ;;
    *) REQUESTED_FNS+=("$arg") ;;
  esac
done

deploy_list() {
  if [[ "${#REQUESTED_FNS[@]}" -gt 0 ]]; then
    printf '%s\n' "${REQUESTED_FNS[@]}"
  else
    printf '%s\n' "${ALL_FNS[@]}"
  fi
}

validate_deployed() {
  echo ""
  echo "🔎 Validando functions publicadas em $SELFHOST_BASE_URL ..."
  local fail=0
  for fn in "${VALIDATE_FNS[@]}"; do
    local tmp status body cors
    tmp=$(mktemp)
    status=$(curl -sS -o "$tmp" -w '%{http_code}' -X OPTIONS "$SELFHOST_BASE_URL/functions/v1/$fn" 2>/dev/null || echo "000")
    body=$(cat "$tmp" 2>/dev/null || true)
    rm -f "$tmp"
    cors=$(curl -sI -X OPTIONS "$SELFHOST_BASE_URL/functions/v1/$fn" 2>/dev/null | grep -i '^access-control-allow-origin:' || true)
    if [[ "$status" =~ ^2 ]] && [[ -n "$cors" ]] && [[ "$body" != *"InvalidWorkerCreation"* ]]; then
      echo "  ✅ $fn  →  HTTP $status + CORS ok"
    else
      echo "  ❌ $fn  →  HTTP $status (NÃO publicada, sem CORS ou boot quebrado)"
      [[ -n "$body" ]] && echo "     body: ${body:0:180}"
      fail=1
    fi
  done
  if [[ "$fail" -eq 0 ]]; then
    echo ""
    echo "🎉 Todas as functions críticas estão no ar com a versão nova."
  else
    echo ""
    echo "⚠️  Uma ou mais functions não responderam com o header de versão."
    echo "   Diagnóstico rápido:"
    echo "     docker ps | grep functions"
    echo "     docker logs supabase-edge-functions --tail 80"
    echo "   Veja MIGRATION-FUNCTIONS.md → 'Validação pós-deploy'."
    exit 1
  fi
}

# ─── Detecta stack docker self-hosted ─────────────────────────────────────
detect_docker_stack() {
  for path in \
    "${SUPABASE_DOCKER_DIR:-}" \
    "$HOME/supabase/docker" \
    "/root/supabase/docker" \
    "/opt/supabase/docker" \
    "/srv/supabase/docker"; do
    [[ -z "$path" ]] && continue
    if [[ -f "$path/docker-compose.yml" ]]; then
      echo "$path"
      return 0
    fi
  done
  return 1
}

deploy_docker_fallback() {
  echo ""
  echo "🐳 Modo Docker fallback (sem SUPABASE_ACCESS_TOKEN)"

  local STACK
  if ! STACK=$(detect_docker_stack); then
    echo "❌ Não encontrei o stack supabase/docker."
    echo "   Defina SUPABASE_DOCKER_DIR=/caminho/pro/supabase/docker e rode de novo."
    exit 1
  fi
  echo "   Stack: $STACK"

  # Caminho do volume das functions dentro do stack
  local VOL="$STACK/volumes/functions"
  if [[ ! -d "$VOL" ]]; then
    echo "❌ Volume não existe: $VOL"
    echo "   Confira o caminho real do volume montado em /home/deno/functions no docker-compose.yml"
    exit 1
  fi
  echo "   Volume: $VOL"

  # Detecta docker compose vs docker-compose
  local DC
  if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
  else
    echo "❌ docker compose não encontrado."
    exit 1
  fi

  echo ""
  mapfile -t DEPLOY_FNS < <(deploy_list)
  echo "📦 Sincronizando ${#DEPLOY_FNS[@]} functions para $VOL ..."
  local SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/functions"
  if [[ ! -d "$SRC_DIR" ]]; then
    echo "❌ Não encontrei $SRC_DIR"
    exit 1
  fi

  # Copia _shared (se existir) e cada function listada
  if [[ -d "$SRC_DIR/_shared" ]]; then
    mkdir -p "$VOL/_shared"
    cp -a "$SRC_DIR/_shared/." "$VOL/_shared/"
    echo "  → _shared"
  fi
  for fn in "${DEPLOY_FNS[@]}"; do
    if [[ -d "$SRC_DIR/$fn" ]]; then
      mkdir -p "$VOL/$fn"
      cp -a "$SRC_DIR/$fn/." "$VOL/$fn/"
      echo "  → $fn"
    else
      echo "  ⚠️  pasta ausente: $SRC_DIR/$fn (pulando)"
    fi
  done

  echo ""
  echo "🧪 Validando YAML do docker-compose antes de mexer no container ..."
  if ! (cd "$STACK" && $DC config -q) 2>/tmp/dc-config-err; then
    echo "❌ docker-compose.yml inválido em $STACK/docker-compose.yml"
    echo ""
    cat /tmp/dc-config-err
    echo ""
    echo "👉 Rode para ver a linha exata:"
    echo "     cd $STACK && docker compose config"
    echo ""
    echo "Pegadinhas comuns:"
    echo "  • 'environment:' com indentação diferente de 'volumes:' (precisam estar no mesmo nível)"
    echo "  • duas chaves 'depends_on:' no mesmo service (precisa mesclar em uma só)"
    echo "  • mistura de tab e espaço"
    exit 1
  fi
  echo "   ok"

  echo ""
  echo "🔄 Restart do container functions ..."
  if ! (cd "$STACK" && $DC restart functions) 2>/tmp/dc-restart-err; then
    echo "⚠️  restart falhou, tentando up -d --force-recreate ..."
    cat /tmp/dc-restart-err
    (cd "$STACK" && $DC up -d --force-recreate functions)
  fi

  echo ""
  echo "⏳ Aguardando container voltar (até 30s) ..."
  for i in $(seq 1 30); do
    if curl -sf -o /dev/null "$SELFHOST_BASE_URL/functions/v1/send-push" -X OPTIONS; then
      echo "   ok"
      break
    fi
    sleep 1
  done

  validate_deployed
}

# ─── MODO CLI ─────────────────────────────────────────────────────────────
deploy_cli() {
  : "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
  : "${PROJECT_REF:?defina PROJECT_REF}"

  echo "🔗 Linkando projeto $PROJECT_REF ..."
  supabase link --project-ref "$PROJECT_REF"

  if [[ "$WANT_SECRETS" == "true" ]]; then
    echo ""
    echo "🔐 Cadastrando secrets ..."
    read -srp "GOOGLE_GEMINI_API_KEY: " GK; echo
    read -srp "ASAAS_API_KEY: " AK; echo
    ATK=$(openssl rand -hex 24)
    supabase secrets set \
      GOOGLE_GEMINI_API_KEY="$GK" \
      ASAAS_API_KEY="$AK" \
      ASAAS_WEBHOOK_TOKEN="$ATK"
    echo "✅ Secrets cadastrados. ASAAS_WEBHOOK_TOKEN: $ATK"
  fi

  echo ""
  mapfile -t DEPLOY_FNS < <(deploy_list)
  echo "🚀 Deployando ${#DEPLOY_FNS[@]} functions ..."
  for fn in "${DEPLOY_FNS[@]}"; do
    if printf '%s\n' "${PUBLIC_FNS[@]}" | grep -qx "$fn"; then
      echo "  → $fn (--no-verify-jwt)"
      supabase functions deploy "$fn" --no-verify-jwt
    else
      echo "  → $fn"
      supabase functions deploy "$fn"
    fi
  done

  validate_deployed
}

# ─── Roteamento ───────────────────────────────────────────────────────────
if [[ "$FORCE_DOCKER" == "true" ]] || [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] || [[ -z "${PROJECT_REF:-}" ]]; then
  if [[ "$FORCE_DOCKER" != "true" ]]; then
    echo "ℹ️  SUPABASE_ACCESS_TOKEN/PROJECT_REF ausentes → entrando no modo Docker fallback."
    echo "   (Para forçar o modo CLI, exporte ambas as variáveis antes de rodar.)"
  fi
  deploy_docker_fallback
else
  deploy_cli
fi
