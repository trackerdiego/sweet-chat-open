

User confirms:
1. Quer continuar self-hosted (`api.influlab.pro`)
2. Tem acesso SSH ao servidor
3. Anon key no `client.ts` é a real (gerada pelo JWT_SECRET do self-hosted)

Então o problema NÃO é chave inválida em si — é que o backend self-hosted tá rejeitando como `UNAUTHORIZED_LEGACY_JWT`. Isso acontece quando:
- O Supabase self-hosted foi atualizado pra versão nova que usa **signing keys** (assimétrico) em vez de JWT_SECRET (simétrico/legado)
- A anon key foi gerada no formato HS256 antigo, mas o GoTrue/Kong agora exige RS256/ES256
- OU as edge functions foram deployadas com versão de SDK que não aceita mais o legacy JWT

Outra possibilidade forte: o `verify_jwt` das functions privadas tá `true` (default), e o Kong/edge-runtime do self-hosted rejeita antes mesmo de chegar no código da function.

Plano enxuto:

## Diagnóstico (vou fazer no modo default)

1. **Smoke test direto** no `api.influlab.pro`:
   - `curl https://api.influlab.pro/auth/v1/health` → ver versão do GoTrue
   - `curl -H "apikey: <anon>" https://api.influlab.pro/rest/v1/` → confirma se a anon key é aceita pelo PostgREST
   - `curl -H "Authorization: Bearer <anon>" https://api.influlab.pro/functions/v1/ai-chat` → reproduzir o 401

2. **Identificar a causa exata** do `UNAUTHORIZED_LEGACY_JWT`:
   - Se PostgREST aceita mas Functions rejeita → problema é no edge-runtime do self-hosted (config de signing keys)
   - Se PostgREST também rejeita → anon key precisa ser regerada

## Correção (depende do diagnóstico)

**Cenário A — Signing keys habilitado no self-hosted (mais provável):**
Você roda no servidor via SSH:
```bash
# Desabilitar signing keys e voltar pro JWT_SECRET legado
docker exec supabase-auth env | grep JWT
# Garantir GOTRUE_JWT_SECRET = mesmo valor do .env do supabase
# Reiniciar:
docker compose restart auth kong functions
```
Eu te entrego o checklist exato com comandos.

**Cenário B — Functions exigindo verify_jwt:**
Editar `supabase/config.toml` adicionando `verify_jwt = false` pras 9 functions privadas (já que elas validam JWT no código com `getUser()`). Redeployar via `./scripts/deploy-selfhost.sh`.

**Cenário C — Anon key incompatível:**
Regerar anon key no servidor:
```bash
# No servidor:
docker exec supabase-kong cat /etc/kong/kong.yml | grep key
# Ou gerar nova com:
supabase gen anon-key
```
Atualizar `src/integrations/supabase/client.ts` com a nova chave.

## Validação final
- `supabase--curl_edge_functions` no `ai-chat` autenticado → deve retornar 200
- Painel admin reaparece pro `agentevendeagente@gmail.com`
- Onboarding/matrix gera sem 401

## Entregáveis
1. Relatório do diagnóstico (qual cenário caiu)
2. Checklist SSH com comandos exatos pra você rodar no servidor
3. Edits necessários no repo (config.toml e/ou client.ts)
4. Smoke test final confirmando

Sem mexer em nada agora — só diagnóstico + plano cirúrgico de correção.

