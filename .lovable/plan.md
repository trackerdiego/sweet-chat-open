

# Plano: subir o Kong (e o functions) que estão faltando — causa real do 502

## Diagnóstico definitivo

A saída do diagnóstico é cristalina:

1. **YAML está válido** ✅ (`docker compose config -q` passou)
2. **Mas o container `supabase-kong` NÃO está rodando** — não aparece em `docker ps` nem em `docker compose ps`
3. **O container `supabase-edge-functions` também NÃO está rodando** — mesma coisa
4. Auth, db, studio, storage, etc. estão todos `(healthy)` há 8 horas
5. Cloudflare devolve **502** em tudo (`/auth/v1/*`, `/functions/v1/*`) porque o nginx da VPS está tentando fazer proxy pro Kong que não existe
6. Logs do kong vazios (seção 5) confirmam: container nunca subiu nesse boot

### Por que isso aconteceu

Quando a YAML foi consertada, você deu `restart functions`, mas **nunca deu `up -d` no kong**. Como o kong já estava parado de antes (provavelmente desde o erro de YAML original), ele continuou parado. O `auth` ficou no ar porque já tava up de 8h atrás, antes da quebra.

Resultado: `nginx → kong (caiu) → 502`.

## Correção (1 comando, 30 segundos)

Você não precisa colar nada novo no `docker-compose.yml`. Ele tá válido. Só precisa **subir o que está faltando**:

```bash
cd /root/supabase/docker
docker compose up -d kong functions
```

Isso cria e inicia os 2 containers ausentes sem mexer nos outros.

## Validação imediata

```bash
# 1. Confirma que kong e functions estão healthy
docker compose ps kong functions

# 2. Health do auth via Kong (esperado: HTTP/2 200, JSON com "version")
curl -i https://api.influlab.pro/auth/v1/health

# 3. Preflight CORS do login (esperado: HTTP/2 204 + headers access-control-*)
curl -i -X OPTIONS https://api.influlab.pro/auth/v1/token?grant_type=password \
  -H "Origin: https://app.influlab.pro" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type"

# 4. Preflight CORS da function nova
curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run \
  | grep -iE 'http|x-influlab-function-version'
```

Se os 4 passarem, **o login no app.influlab.pro volta na hora** — não precisa nem refresh forçado, é só recarregar.

## Se `docker compose up -d kong functions` falhar

Cenário improvável (YAML tá ok), mas se acontecer, manda na próxima mensagem:

```bash
docker compose up -d kong functions 2>&1 | tail -30
docker logs supabase-kong --tail 60 2>&1
docker logs supabase-edge-functions --tail 60 2>&1
```

Aí eu te entrego o conserto exato sem precisar de mais nenhuma rodada.

## O que vou alterar no repo

**Nada.** O problema está 100% resolvido com 1 comando na VPS. Mexer em arquivo do repo agora só atrasaria.

## Por que essa é a hipótese certa (e não outra)

- ❌ Não é CORS de config — Kong nem responde, devolve 502 antes de chegar em qualquer header
- ❌ Não é YAML — `docker compose config -q` retornou válido
- ❌ Não é DNS / Cloudflare — outros serviços responderiam, e o erro 502 do CF mostra que ele alcança a VPS mas a VPS não tem upstream pra entregar
- ❌ Não é o auth — auth está `healthy` há 8h, só não tem ninguém na frente roteando pra ele
- ✅ É **container ausente**: `docker ps` lista 12 containers do stack, faltam exatamente os 2 que importam pro tráfego HTTP do app (kong e functions)

## Resultado esperado depois do `up -d`

- `supabase-kong` aparece em `docker ps` com status `healthy`
- `supabase-edge-functions` aparece em `docker ps`
- Login volta a funcionar em https://app.influlab.pro
- Onboarding assíncrono começa a responder (com `x-influlab-function-version` no header)
- Próxima vez que precisar mexer em config, o `deploy-selfhost.sh` já tem o pré-check de YAML e o fallback de `up -d --force-recreate`, então não dá pra repetir esse vexame

