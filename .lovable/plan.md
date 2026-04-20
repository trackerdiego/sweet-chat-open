
User pergunta se os pagamentos estão funcionais e quer simular uma chamada ao webhook Asaas.

Contexto importante: o backend tá no **self-hosted** (`api.influlab.pro`), não no Supabase Lovable Cloud (`gchncrlrmsyzumgmbplh.supabase.co`). O webhook Asaas em produção aponta pro self-hosted. A função `asaas-webhook` existe nos dois lugares (código é o mesmo), mas:
- O Asaas real chama o self-hosted
- Eu posso testar via `curl` o endpoint do self-hosted (público, `verify_jwt=false`)
- Posso também testar a versão deployada no Lovable Cloud via `supabase--curl_edge_functions` pra validar a lógica do código

O usuário quer saber se "está funcional". Pra responder bem, preciso:
1. Validar que o endpoint responde (smoke test)
2. Simular um evento `PAYMENT_CONFIRMED` com um `externalReference` real (user_id) e checar se o `is_premium` foi pra `true` em `user_usage`
3. Reverter pra `false` depois (não quero promover ninguém de verdade)

Mas tem uma trava: o webhook valida o header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`. Eu não tenho esse token (é secret). Sem ele, retorna 401.

Opções:
- (a) Pedir ao user pra colar o `ASAAS_WEBHOOK_TOKEN` (ou um curl pronto pra ele rodar no terminal dele)
- (b) Fazer só o smoke test sem auth (vai dar 401 — mas confirma que tá no ar e a validação tá funcionando)
- (c) Eu monto o curl, ele roda

Acho mais limpo: smoke test sem auth (confirma 401 = validação OK) + entregar curl pronto pro user rodar com o token real, escolhendo um user_id de teste. Sem mexer em premium de ninguém de verdade.

Plano enxuto:

## Plano

### 1. Verificações automáticas (eu rodo)

a. **Smoke test no self-hosted sem token** → espero `401 Unauthorized` (confirma que o endpoint tá no ar e a validação anti-spoof funciona).

```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"externalReference":"fake"}}'
```

b. **Listar usuários free recentes** no banco do self-hosted via `supabase--read_query` — pegar um `user_id` candidato pra teste (idealmente o próprio user, pra ele ver mudar no app).

⚠️ Nota: `supabase--read_query` aponta pro projeto Lovable (`gchncrlrmsyzumgmbplh`), não pro self-hosted. Como o app real roda contra self-hosted, essa query não reflete os dados de produção. Vou avisar e pedir ao user pra rodar a query no Studio dele se quiser ver dados reais.

### 2. Curl pronto pro user rodar (com token real)

Vou entregar 2 cenários prontos:

**Cenário A — Confirmar pagamento (ativa premium)**
```bash
ASAAS_WEBHOOK_TOKEN="<cola-aqui>"
USER_ID="<user_id-de-teste>"

curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -d "{
    \"event\": \"PAYMENT_CONFIRMED\",
    \"payment\": {
      \"id\": \"pay_test_$(date +%s)\",
      \"externalReference\": \"$USER_ID\",
      \"value\": 47,
      \"status\": \"CONFIRMED\"
    }
  }"
```
Esperado: `200 {"received":true}` + `is_premium=true` em `user_usage`.

**Cenário B — Reverter (cancelar premium)**
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -d "{
    \"event\": \"SUBSCRIPTION_DELETED\",
    \"subscription\": { \"externalReference\": \"$USER_ID\" }
  }"
```
Esperado: `200` + `is_premium=false`.

### 3. Validação no banco (user roda no Studio self-hosted)

```sql
select user_id, is_premium, updated_at
from public.user_usage
where user_id = '<USER_ID>';
```

### 4. Onde achar o token

`ASAAS_WEBHOOK_TOKEN` foi gerado pelo `scripts/deploy-selfhost.sh --secrets` na primeira instalação. Se o user perdeu, dá pra rodar `supabase secrets list` no servidor self-hosted (mostra nomes, não valores) e regerar via `supabase secrets set ASAAS_WEBHOOK_TOKEN=$(openssl rand -hex 24)` — mas aí precisa atualizar no painel Asaas também.

### 5. O que **não** vou fazer

- Não vou ativar premium pra usuário real sem o user escolher o ID.
- Não vou rodar `INSERT`/`UPDATE` no banco — só leitura + curl no endpoint que já valida token.
- Não vou redeployar nada (a função `asaas-webhook` não mudou).

### Resultado esperado

- Se cenário A retornar 200 e o `is_premium` virar `true` → pagamentos 100% funcionais ponta-a-ponta.
- Se retornar 401 com token correto → secret no servidor não bate com o do painel Asaas.
- Se retornar 500 → bug no código, abro logs via `supabase--edge_function_logs` (mas isso só vê o Lovable Cloud, não o self-hosted; pro self-hosted o user precisa olhar `docker compose logs functions`).
