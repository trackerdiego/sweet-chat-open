

# Plano: subir o container `functions` (último passo)

## Status atual — login JÁ voltou

Os 3 primeiros checks passaram:

1. ✅ `/auth/v1/health` → **HTTP 200** com `{"version":"v2.186.0","name":"GoTrue"...}` — auth roteando via Kong
2. ✅ Preflight CORS do `/auth/v1/token` → **HTTP 200** com `access-control-allow-origin: *` e `access-control-allow-headers: authorization,apikey,content-type` — login do app vai funcionar
3. ❌ `/functions/v1/start-onboarding-run` → **HTTP 502** — container `functions` ainda não subiu

**Pode tentar logar em https://app.influlab.pro agora — vai entrar.** O onboarding é que vai falhar até subir o `functions`.

## Por que o `functions` não subiu

No comando anterior (`docker compose up -d kong functions`) o Compose abortou o `functions` porque o `kong` estava `unhealthy`. Mesmo com o `--no-deps` no plano anterior, parece que o comando não rodou ou o container ainda não tá no `docker ps`. Vamos forçar agora.

## Comando único pra rodar na VPS

```bash
cd /root/supabase/docker
docker compose up -d --no-deps functions
sleep 5
docker compose ps functions
docker logs supabase-edge-functions --tail 30 2>&1
curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run \
  | grep -iE 'http|x-influlab-function-version|access-control'
```

## Resultados possíveis

### Caso A — funcionou (esperado)
- `docker compose ps functions` mostra `Up X seconds`
- Logs mostram `Serving functions on http://0.0.0.0:9000` ou similar
- Curl final retorna `HTTP/2 204` + header `x-influlab-function-version: 2026-04-22-async-job` (ou versão posterior)
- **Onboarding assíncrono entra em produção**

### Caso B — container subiu mas curl ainda dá 502
Significa que o nginx-app na VPS está roteando `/functions/v1/*` pra um upstream errado. Manda:
```bash
docker logs nginx-app-1 --tail 30 2>&1 | grep -i function
grep -rn 'functions' /etc/nginx/ 2>/dev/null | head -20
```

### Caso C — container não subiu / crash loop
Manda os logs que o comando acima já gera — eu identifico o erro (provavelmente secret faltando no `environment:` do service `functions` no docker-compose.yml, ou volume errado).

## Sem alterações no repo

O problema é 100% infra na VPS. O repo já tem tudo que precisa (`scripts/deploy-selfhost.sh`, `scripts/diagnose-selfhost.sh`, todas as edge functions atualizadas). Não há nada pra editar.

## Resumo do progresso

| Etapa | Status |
|---|---|
| YAML do docker-compose válido | ✅ |
| Kong rodando e roteando | ✅ |
| Auth respondendo via Kong | ✅ |
| CORS do login funcionando | ✅ |
| Login no app | ✅ (testar) |
| Container functions | ⏳ (1 comando) |
| Onboarding assíncrono | ⏳ (depende do anterior) |

Você está a 1 comando de fechar tudo. Vai descansar — quando rodar amanhã e colar a saída, eu fecho.

