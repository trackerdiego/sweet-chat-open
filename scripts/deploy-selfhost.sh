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
  generate-audience-profile
  generate-personalized-matrix
  start-onboarding-run
  get-onboarding-run-status
  transcribe-media
  admin-dashboard
  create-asaas-subscription
)

ALL_FNS=("${PUBLIC_FNS[@]}" "${PRIVATE_FNS[@]}")

VALIDATE_FNS=(
  start-onboarding-run
  get-onboarding-run-status
  generate-audience-profile
  generate-personalized-matrix
)

SELFHOST_BASE_URL="${SELFHOST_BASE_URL:-https://api.influlab.pro}"

WANT_SECRETS=false
FORCE_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --secrets) WANT_SECRETS=true ;;
    --force-docker) FORCE_DOCKER=true ;;
  esac
done

validate_deployed() {
  echo ""
  echo "🔎 Validando functions publicadas em $SELFHOST_BASE_URL ..."
  local fail=0
  for fn in "${VALIDATE_FNS[@]}"; do
    local hdr
    hdr=$(curl -sI -X OPTIONS "$SELFHOST_BASE_URL/functions/v1/$fn" 2>/dev/null | grep -i 'x-influlab-function-version' || true)
    if [[ -n "$hdr" ]]; then
      echo "  ✅ $fn  →  ${hdr%$'\r'}"
    else
      echo "  ❌ $fn  →  sem x-influlab-function-version (NÃO publicada ou versão antiga)"
      fail=1
    fi
  done
  if [[ "$fail" -eq 0 ]]; then
    echo ""
    echo "🎉 Todas as functions críticas estão no ar com a versão nova."
  else
    echo ""
    echo "⚠️  Uma ou mais functions não responderam com o header de versão."
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
  echo "📦 Sincronizando ${#ALL_FNS[@]} functions para $VOL ..."
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
  for fn in "${ALL_FNS[@]}"; do
    if [[ -d "$SRC_DIR/$fn" ]]; then
      mkdir -p "$VOL/$fn"
      cp -a "$SRC_DIR/$fn/." "$VOL/$fn/"
      echo "  → $fn"
    else
      echo "  ⚠️  pasta ausente: $SRC_DIR/$fn (pulando)"
    fi
  done

  echo ""
  echo "🔄 Restart do container functions ..."
  (cd "$STACK" && $DC restart functions)

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
  echo "🚀 Deployando ${#PUBLIC_FNS[@]} functions públicas ..."
  for fn in "${PUBLIC_FNS[@]}"; do
    echo "  → $fn (--no-verify-jwt)"
    supabase functions deploy "$fn" --no-verify-jwt
  done

  echo ""
  echo "🚀 Deployando ${#PRIVATE_FNS[@]} functions privadas ..."
  for fn in "${PRIVATE_FNS[@]}"; do
    echo "  → $fn"
    supabase functions deploy "$fn"
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
