#!/usr/bin/env bash
# Deploy de todas as edge functions + secrets pro Supabase self-hosted (api.influlab.pro)
#
# Pré-requisitos:
#   - Supabase CLI instalado: https://supabase.com/docs/guides/cli
#   - Docker rodando localmente (necessário pro bundle das functions)
#
# Uso:
#   export SUPABASE_ACCESS_TOKEN=<token-do-studio-self-hosted>
#   export PROJECT_REF=<ref-do-projeto-self-hosted>
#   chmod +x scripts/deploy-selfhost.sh
#
#   # Primeira vez (cadastra secrets + deploy de tudo):
#   ./scripts/deploy-selfhost.sh --secrets
#
#   # Deploys subsequentes (só código, secrets já estão lá):
#   ./scripts/deploy-selfhost.sh

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN antes de rodar}"
: "${PROJECT_REF:?defina PROJECT_REF antes de rodar}"

echo "🔗 Linkando projeto $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

# ─── Secrets (opcional, só roda com --secrets) ────────────────────────────
if [[ "${1:-}" == "--secrets" ]]; then
  echo ""
  echo "🔐 Cadastrando secrets (digite os valores quando solicitado)..."
  read -srp "GOOGLE_GEMINI_API_KEY: " GK; echo
  read -srp "ASAAS_API_KEY: " AK; echo
  ATK=$(openssl rand -hex 24)

  supabase secrets set \
    GOOGLE_GEMINI_API_KEY="$GK" \
    ASAAS_API_KEY="$AK" \
    ASAAS_WEBHOOK_TOKEN="$ATK"

  echo ""
  echo "✅ Secrets cadastrados."
  echo "📌 ASAAS_WEBHOOK_TOKEN gerado (SALVE — você precisa cadastrar no painel Asaas):"
  echo "   $ATK"
  echo ""
fi

# ─── Functions públicas (sem JWT) ─────────────────────────────────────────
PUBLIC_FNS=(
  asaas-webhook
  send-push
  scheduled-push
  process-email-queue
  auth-email-hook
)

# ─── Functions privadas (com JWT) ─────────────────────────────────────────
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

echo "🚀 Deployando ${#PUBLIC_FNS[@]} functions públicas..."
for fn in "${PUBLIC_FNS[@]}"; do
  echo "  → $fn (--no-verify-jwt)"
  supabase functions deploy "$fn" --no-verify-jwt
done

echo ""
echo "🚀 Deployando ${#PRIVATE_FNS[@]} functions privadas..."
for fn in "${PRIVATE_FNS[@]}"; do
  echo "  → $fn"
  supabase functions deploy "$fn"
done

echo ""
echo "✅ Deploy concluído ($((${#PUBLIC_FNS[@]} + ${#PRIVATE_FNS[@]})) functions)"
echo ""
echo "Próximo passo: rode o bloco SQL (cron jobs + storage policies) no SQL Editor do Studio."
echo "Veja MIGRATION-FUNCTIONS.md → seção 'Self-Hosted Deploy'."
