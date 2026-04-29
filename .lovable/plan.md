Pelo teste que você rodou, estamos prontos para uma parte importante: `PAYMENT_CREATED` está chegando, gravando auditoria, preenchendo `next_invoice` e deduplicando corretamente.

Mas para o ponto específico do Tálison Girão — usuário com dados do Asaas, mas sem `asaas_subscription_id` — eu não considero 100% blindado ainda. O código atual já trata `subscription` quando ele vem no payload, porém ainda tem lacunas que podem deixar `subscription_state.asaas_subscription_id` vazio em alguns cenários reais.

## Diagnóstico

Hoje o fluxo está assim:

```text
create-asaas-subscription
  -> cria customer no Asaas
  -> cria subscription no Asaas com externalReference = user_id
  -> tenta salvar asaas_subscription_id + asaas_customer_id em subscription_state

asaas-webhook
  -> PAYMENT_CREATED salva next_invoice com asaas_subscription_id dentro do JSON
  -> SUBSCRIPTION_CREATED/UPDATED salva asaas_subscription_id em subscription_state
  -> PAYMENT_RECEIVED ativa premium e sincroniza subscription_state se vier subscription no payload
```

O teste `PAYMENT_CREATED` validou que o campo `payment.subscription` foi salvo dentro de:

```text
subscription_state.next_invoice.asaas_subscription_id
```

Mas ele não validou que esse mesmo valor foi promovido para:

```text
subscription_state.asaas_subscription_id
```

No snapshot, inclusive, ficou assim:

```json
"asaas_subscription_id": null,
"next_invoice_present": true
```

Isso explica o risco: se o usuário pagar ou renovar e o app depender de `subscription_state.asaas_subscription_id`, ele pode continuar vazio mesmo tendo uma fatura com subscription dentro de `next_invoice`.

## O que precisa ser ajustado

### 1. Atualizar `PAYMENT_CREATED` para também preencher `subscription_state`

Quando vier um payload como:

```json
{
  "event": "PAYMENT_CREATED",
  "payment": {
    "externalReference": "user_id",
    "subscription": "sub_xxx",
    "customer": "cus_xxx",
    "value": 47,
    "dueDate": "2026-05-04"
  }
}
```

Além de salvar `next_invoice`, o webhook deve atualizar também:

```text
subscription_state.asaas_subscription_id = payment.subscription
subscription_state.asaas_customer_id = payment.customer
subscription_state.plan = monthly/annual inferido pelo valor
subscription_state.current_period_end = dueDate ou fallback
```

Sem mudar `status` para `active` nesse evento, porque `PAYMENT_CREATED` ainda não significa pagamento confirmado.

### 2. Melhorar `PAYMENT_RECEIVED`

No pagamento confirmado, garantir que o webhook sempre faça upsert de `subscription_state` com:

```text
status = active
asaas_subscription_id
asaas_customer_id
plan
current_period_end
```

Hoje ele tenta fazer isso, mas podemos reforçar para não perder dados quando alguns campos vêm em formatos diferentes ou faltam no payload.

### 3. Adicionar fallback payload-first + API fallback

Se o payload vier sem `externalReference`, mas vier `payment.subscription`, o webhook já tenta buscar a assinatura no Asaas. Vamos manter e reforçar isso.

Fluxo desejado:

```text
1. tenta user_id via payment.externalReference
2. se não tiver, tenta buscar subscription no Asaas usando payment.subscription
3. pega subscription.externalReference
4. salva user_id no asaas_webhook_events
5. sincroniza subscription_state
```

### 4. Criar rotina SQL de backfill para usuários já afetados

Para corrigir casos como Tálison Girão, entregar um SQL seguro para rodar no Studio self-hosted ou via VPS, preenchendo `asaas_subscription_id` e `asaas_customer_id` a partir dos eventos já recebidos:

```text
asaas_webhook_events.payload.payment.subscription
asaas_webhook_events.payload.payment.customer
asaas_webhook_events.payload.subscription.id
asaas_webhook_events.payload.subscription.customer
```

A ideia é recuperar registros onde:

```text
subscription_state.asaas_subscription_id is null
```

mas existe evento Asaas com `user_id` e `subscription` no payload.

### 5. Ajustar o script de simulação

Atualizar `scripts/simulate-asaas-webhook.sh` para:

- usar Docker `psql` por padrão no self-hosted;
- não falhar na checagem de `auth.users` por causa de retorno `true` vs `t`;
- não fazer cleanup destrutivo em usuário real sem deixar claro;
- no cenário `created`, validar também:

```text
asaas_subscription_id = sub_sim_xxx
asaas_customer_id = cus_sim_xxx
next_invoice.asaas_subscription_id = sub_sim_xxx
```

Assim, o teste passa a responder exatamente sua pergunta: “o Asaas mandou todos os campos e nós alocamos nas tabelas certas?”

## Critério de pronto

Depois da alteração, um novo `PAYMENT_CREATED` deve deixar o snapshot assim:

```json
{
  "status": "active ou trial/past_due conforme estado anterior",
  "plan": "monthly",
  "asaas_subscription_id": "sub_xxx",
  "next_invoice_present": true,
  "next_invoice_due": "2026-05-04"
}
```

E um `PAYMENT_RECEIVED` deve deixar:

```json
{
  "is_premium": true,
  "status": "active",
  "plan": "monthly",
  "asaas_subscription_id": "sub_xxx",
  "asaas_customer_id": "cus_xxx",
  "next_invoice_present": false
}
```

## Plano de implementação

1. Alterar `supabase/functions/asaas-webhook/index.ts` para sincronizar `subscription_state` também em `PAYMENT_CREATED`, sem ativar premium.
2. Reforçar `PAYMENT_RECEIVED` para sempre persistir os IDs do Asaas quando eles vierem no payload ou forem recuperados via API.
3. Ajustar o script `scripts/simulate-asaas-webhook.sh` para validar os campos que faltaram no teste.
4. Entregar SQL manual de backfill para rodar no Supabase self-hosted e recuperar usuários antigos com `asaas_subscription_id` ausente.
5. Te passar o bloco copia-e-cola da VPS para atualizar o repo, redeployar a função `asaas-webhook` e rodar o teste novamente.

## Minha conclusão

Estamos parcialmente prontos: o recebimento, auditoria, dedupe e `next_invoice` estão funcionando.

Mas eu recomendo aplicar essa blindagem antes de considerar produção “fechada”, porque o caso do Tálison mostra exatamente a lacuna: o Asaas pode mandar `subscription`, a fatura pode ser salva, mas o campo principal `subscription_state.asaas_subscription_id` continuar vazio se não vier/rodar um evento `SUBSCRIPTION_CREATED` ou se a criação inicial falhar no espelhamento.