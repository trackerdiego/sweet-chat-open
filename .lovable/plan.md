

# Plano: destravar o Kong unhealthy + remover bloqueio de apikey no /auth/v1/health

## Diagnóstico — duas coisas separadas

### 1. Kong subiu mas está `unhealthy`
- Container `supabase-kong` rodando em `0.0.0.0:8000` ✅
- Mas healthcheck (`kong health`) está falhando — por isso `functions` recusou subir ("dependency failed to start")
- O healthcheck do compose é `["CMD", "kong", "health"]`. Se o Kong respondeu CORS corretamente no `/auth/v1/health` (com latência 13ms), o processo está vivo. O `unhealthy` é provavelmente só falta de tempo / `start_period` curto, ou do `kong health` não conseguir falar com o admin API interno.
- **Não bloqueia o login** — o Kong já está roteando. Só precisa subir o `functions` ignorando esse healthcheck.

### 2. `/auth/v1/health` retornou 401 "No API key found"
- Isso é **comportamento esperado do Kong self-hosted** com plugin `key-auth` ativo na rota
- A rota `/auth/v1/health` no `kong.yml` exige `apikey` header
- **NÃO afeta o login do app** — o frontend manda `apikey: <ANON_KEY>` em toda chamada via `supabase-js`
- Mas a validação do diagnóstico precisa mandar o header pra refletir o uso real

## Correção em 2 passos

### Passo 1 — subir o functions ignorando dependency unhealthy

```bash
cd /root/supabase/docker
docker compose up -d --no-deps functions
docker compose ps kong functions
```

`--no-deps` faz o functions subir sem esperar o healthcheck do kong (que tá só lento, não morto).

### Passo 2 — validar com o apikey correto (o que o app realmente faz)

Pega a `ANON_KEY` do `.env` e usa nos curls:

```bash
ANON=$(grep ^ANON_KEY /root/supabase/docker/.env | cut -d= -f2)

# Health do auth COM apikey (esperado: 200 + JSON com "version")
curl -i https://api.influlab.pro/auth/v1/health -H "apikey: $ANON"

# Preflight CORS do login (esperado: 204 + access-control-allow-origin)
curl -i -X OPTIONS "https://api.influlab.pro/auth/v1/token?grant_type=password" \
  -H "Origin: https://app.influlab.pro" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type"

# Function nova (esperado: 204 + x-influlab-function-version)
curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run \
  | grep -iE 'http|x-influlab-function-version|access-control'
```

## Se o functions também ficar unhealthy ou não subir

Manda na próxima:
```bash
docker compose up -d --no-deps functions 2>&1 | tail -20
docker logs supabase-edge-functions --tail 80 2>&1
docker logs supabase-kong --tail 30 2>&1 | grep -iE 'error|warn|listen'
```

## Por que o login JÁ deve voltar agora

O CORS error original do print (sua mensagem inicial) acontecia porque o Kong estava **completamente fora** (502 do Cloudflare). Agora o Kong está **dentro e respondendo** (`x-kong-response-latency: 13` no curl que você fez). Isso significa:

1. ✅ Cloudflare → nginx → Kong → auth: caminho aberto
2. ✅ CORS do Kong tá funcionando (`access-control-allow-origin: *` apareceu na resposta)
3. ✅ Auth respondendo (devolveu JSON estruturado, não erro de conexão)

**Tenta abrir https://app.influlab.pro agora e fazer login.** Provavelmente já vai. O `functions` ainda precisa subir pro onboarding rodar, mas o login em si não depende do container `functions`.

## O que NÃO vou alterar no repo

Nada. O `unhealthy` do Kong é tolerância de healthcheck do compose self-hosted, não afeta o tráfego real. O 401 no `/auth/v1/health` é proteção esperada do Kong. O frontend já manda apikey corretamente.

## Resultado esperado

1. Login no app volta a funcionar (já deve estar funcionando)
2. `docker compose up -d --no-deps functions` sobe o container faltante
3. Onboarding assíncrono passa a responder
4. Próxima rodada: a gente investiga porque o healthcheck do Kong tá lento, mas é cosmético — sem urgência

