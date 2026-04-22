#!/usr/bin/env bash
# Diagnóstico read-only do stack Supabase self-hosted.
# Não muda nada na VPS — só coleta estado pra debug.
#
# Uso:
#   ./scripts/diagnose-selfhost.sh > /tmp/diag.txt 2>&1
#   cat /tmp/diag.txt

set +e

STACK="${SUPABASE_DOCKER_DIR:-/root/supabase/docker}"
BASE_URL="${SELFHOST_BASE_URL:-https://api.influlab.pro}"
APP_ORIGIN="${APP_ORIGIN:-https://app.influlab.pro}"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

section() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════════════"
}

section "1. Identificação"
echo "Stack: $STACK"
echo "Base URL: $BASE_URL"
echo "App Origin: $APP_ORIGIN"
echo "Docker compose: $DC"
date

section "2. docker compose ps"
(cd "$STACK" && $DC ps 2>&1)

section "3. Validação do docker-compose.yml"
(cd "$STACK" && $DC config -q 2>&1) && echo "✅ YAML válido" || echo "❌ YAML inválido (ver erro acima)"

section "4. Bloco kong do docker-compose.yml (linhas 1-130)"
sed -n '1,130p' "$STACK/docker-compose.yml" 2>&1 | cat -An

section "5. Logs do container kong (últimas 40 linhas)"
docker logs supabase-kong --tail 40 2>&1

section "6. Logs do container auth (últimas 40 linhas)"
docker logs supabase-auth --tail 40 2>&1

section "7. Logs do container functions (últimas 40 linhas)"
docker logs supabase-edge-functions --tail 40 2>&1

section "8. Preflight CORS — POST /auth/v1/token"
curl -i -X OPTIONS "$BASE_URL/auth/v1/token?grant_type=password" \
  -H "Origin: $APP_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type" \
  --max-time 10 2>&1

section "9. GET /auth/v1/health"
curl -i "$BASE_URL/auth/v1/health" --max-time 10 2>&1

section "10. Preflight CORS — OPTIONS /functions/v1/start-onboarding-run"
curl -i -X OPTIONS "$BASE_URL/functions/v1/start-onboarding-run" \
  -H "Origin: $APP_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type" \
  --max-time 10 2>&1

section "11. docker ps (resumo)"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  FIM do diagnóstico — cole tudo isso na próxima mensagem"
echo "════════════════════════════════════════════════════════════════"
