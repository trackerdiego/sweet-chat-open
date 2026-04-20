
User quer simular webhook Asaas pra confirmar se o fluxo de pagamento tá funcional ponta-a-ponta no self-hosted (`api.influlab.pro`).

Preciso de modo execução pra rodar `curl` e `psql`. Estou em read-only — apresento plano enxuto.

## Plano de teste end-to-end do webhook Asaas

### Pré-requisito

Confirmar que o `ASAAS_WEBHOOK_TOKEN` foi configurado no servidor self-hosted (passos da resposta anterior). Se ainda não foi, o teste B vai falhar com 401 — o que JÁ é informação útil (significa que segurança tá ativa).

### Passos

**1. Smoke test sem token** (deve dar 401 se segurança OK)
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED"}'
```

**2. Identificar user de teste** — query no banco self-hosted (vou pedir pro user rodar no Studio dele, já que `read_query` aponta pro Lovable Cloud, não pro self-hosted):
```sql
select user_id, is_premium from public.user_usage
where is_premium = false order by created_at desc limit 5;
```

**3. Estado ANTES** — anotar `is_premium` do user escolhido.

**4. Disparar PAYMENT_CONFIRMED** (precisa do token real — vou pedir pro user colar antes)
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $TOKEN" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"pay_test","externalReference":"USER_ID","value":47,"status":"CONFIRMED"}}'
```
Esperado: `200 {"received":true}`

**5. Verificar mudança** — query no Studio self-hosted:
```sql
select user_id, is_premium, updated_at from public.user_usage where user_id='USER_ID';
```
Esperado: `is_premium = true`

**6. Reverter com SUBSCRIPTION_DELETED**
```bash
curl -i -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $TOKEN" \
  -d '{"event":"SUBSCRIPTION_DELETED","subscription":{"externalReference":"USER_ID"}}'
```
Esperado: `is_premium = false` de novo.

### Critério de "apto pra receber assinatura"

Tudo OK se:
- ✅ Passo 1 retorna 401 (segurança ativa)
- ✅ Passo 4 retorna 200
- ✅ Passo 5 mostra `is_premium=true`
- ✅ Passo 6 reverte pra `false`

Falhas possíveis:
- 401 no passo 4 → token no painel Asaas ≠ token no servidor
- 200 mas `is_premium` não muda → bug na função (vejo logs `docker compose logs functions` no servidor)
- Passo 1 retorna 200 → segurança bypassada (token não setado no container)

### Inputs que preciso do user antes de executar

1. `ASAAS_WEBHOOK_TOKEN` real (cola aqui, ou roda você mesmo no terminal)
2. Um `user_id` cobaia (de preferência o próprio, pra ver mudar no app)
3. Confirmação que pode mexer em premium temporariamente (ativa e reverte na sequência)

Após aprovação, executo passos 1, 4, 6 (são os que dependem só de curl). Passos 2, 3, 5 (queries no banco self-hosted) você roda no Studio e me devolve o resultado — não tenho acesso direto ao DB do `api.influlab.pro`.
