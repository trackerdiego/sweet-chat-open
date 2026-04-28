## Diagnóstico definitivo

Olhando o código atual + os 2 payloads reais que você capturou, encontrei **6 buracos** que podem fazer um pagamento "sumir" sem popular o `subscription_state` direito. O caso da thalyson caiu em pelo menos 3 deles ao mesmo tempo.

### Os 6 buracos do `asaas-webhook` atual

| # | Buraco | Impacto |
|---|---|---|
| 1 | **`SUBSCRIPTION_CREATED` é ignorado** — o switch só trata PAYMENT_* e SUBSCRIPTION_DELETED/INACTIVE. O evento que tem TODOS os IDs (sub, customer, cycle, nextDueDate, value) é jogado fora. | Perde a janela de ouro pra popular o estado. |
| 2 | **`syncSubscriptionState` só popula `customer_id`/`current_period_end`/`plan` se `apiKey` existe E `fetchSubscription` responde 200.** Se a API key tiver errada, der timeout, ou o Asaas estiver fora, grava só `status='active'` + `asaas_subscription_id`. Tudo o resto fica NULL. | Foi o que rolou com a thalyson — IDs ficaram NULL. |
| 3 | **Não usa o `payment.customer` que já vem no payload de PAYMENT_RECEIVED.** O `cus_xxx` tá lá de graça, mas a função ignora e tenta buscar via API. | Perde dado já entregue. |
| 4 | **Erros silenciosos** — `fetchSubscription` retorna `null` em qualquer falha sem logar. Você nunca sabe que falhou. | Debug impossível depois. |
| 5 | **Sem persistência de evento bruto** — se algo der errado no processamento, o payload original é perdido. Não dá pra reprocessar. | Sem capacidade de recuperação. |
| 6 | **Sem retry / idempotência** — se o webhook responder 500, o Asaas reenvia. Mas se o handler crashar no meio (premium ativo, mas state não atualizou), na segunda tentativa pode dar problema. | Estado parcial inconsistente. |

## A solução: refatoração + tabela de auditoria

### 1) Nova tabela `asaas_webhook_events` (SQL pra você rodar no Studio self-hosted)

Persistência crua de TODO webhook recebido, antes de qualquer processamento. Funciona como **caixa-preta**: se algo der errado, dá pra reprocessar a partir dela.

```sql
CREATE TABLE public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,        -- evt_xxx do Asaas (idempotência)
  event_type text NOT NULL,              -- PAYMENT_RECEIVED, SUBSCRIPTION_CREATED, etc
  user_id uuid,                          -- resolvido do externalReference
  asaas_subscription_id text,
  asaas_customer_id text,
  asaas_payment_id text,
  payload jsonb NOT NULL,                -- payload bruto integral
  processed_at timestamptz,              -- null = ainda não processado / erro
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.asaas_webhook_events (user_id);
CREATE INDEX ON public.asaas_webhook_events (event_type);
CREATE INDEX ON public.asaas_webhook_events (processed_at) WHERE processed_at IS NULL;

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages webhook events" ON public.asaas_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2) Refatorar `asaas-webhook/index.ts` com 4 mudanças cirúrgicas

**Mudança A — Persiste payload ANTES de processar**
Primeiro INSERT em `asaas_webhook_events` com idempotência por `event_id`. Se falhar o INSERT (duplicado), retorna 200 imediato — Asaas não reenvia. Se passar, processa. No fim, marca `processed_at = now()`.

**Mudança B — Tratar `SUBSCRIPTION_CREATED` (NOVO branch)**
```ts
if (event === "SUBSCRIPTION_CREATED") {
  const sub = body.subscription;
  const userId = sub?.externalReference;
  if (userId) {
    await admin.from("subscription_state").upsert({
      user_id: userId,
      status: 'pending',  // ainda não pagou
      asaas_subscription_id: sub.id,
      asaas_customer_id: sub.customer,
      plan: sub.cycle === 'YEARLY' ? 'annual' : 'monthly',
      current_period_end: sub.nextDueDate ? new Date(sub.nextDueDate).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }
}
```

**Mudança C — `syncSubscriptionState` extrai TUDO do payload primeiro**
Em vez de depender de `fetchSubscription`, extrai do que já chegou:
- `asaas_subscription_id` ← `body.payment.subscription` (sempre presente em PAYMENT_*)
- `asaas_customer_id` ← `body.payment.customer` (sempre presente)
- `current_period_end` ← calcula como `payment.dueDate + 30 dias` (mensal) ou `+365` (anual), com base no `plan` já salvo. Se não tiver plan salvo, infere do `payment.value` (47 = monthly, 397 = annual).
- `plan` ← do payload de SUBSCRIPTION_CREATED ou inferido do value.

`fetchSubscription` vira **fallback opcional** pra refinar `current_period_end` exato. Se falhar, ignora e usa o calculado.

**Mudança D — Logs de erro explícitos**
Toda falha de `fetchSubscription`, upsert, etc. é logada com `console.error("[asaas-webhook] <contexto>:", error)` E gravada em `asaas_webhook_events.error_message`.

### 3) Endpoint de reprocessamento `POST /reprocess` (mesma function, novo path)

Pra resgatar pagamentos antigos (incluindo o da thalyson):
```bash
curl -X POST https://api.influlab.pro/functions/v1/asaas-webhook \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"reprocess","event_id":"evt_d26e303b..."}'
```
Lê o payload bruto de `asaas_webhook_events`, roda o pipeline normal. Idempotente.

Como você já tem os 2 payloads da thalyson em mãos, vou também entregar um **SQL de seed** que insere os 2 eventos passados em `asaas_webhook_events` pra você poder reprocessá-los e validar que o fluxo novo funciona end-to-end com dados reais.

### 4) Query de auditoria (entrego pronta pra rodar mensalmente)

```sql
-- Detecta usuários premium sem subscription_id (qualquer caso "thalyson")
SELECT uu.user_id, au.email, ss.status, ss.asaas_subscription_id, ss.current_period_end
FROM public.user_usage uu
LEFT JOIN public.subscription_state ss ON ss.user_id = uu.user_id
LEFT JOIN auth.users au ON au.id = uu.user_id
WHERE uu.is_premium = true
  AND (ss.asaas_subscription_id IS NULL OR ss.current_period_end IS NULL);
```

## Arquivos que serão modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-webhook/index.ts` | Refatoração completa (mantém retro-compat, adiciona persistência + SUBSCRIPTION_CREATED + extração agressiva do payload + endpoint de reprocesso) |
| `/mnt/documents/asaas-webhook-migration.sql` | Cria tabela `asaas_webhook_events` + seed dos 2 eventos da thalyson + audit query |

## O que NÃO vou fazer

- Não toco em `create-asaas-subscription` (já tá correto).
- Não mexo em `apply-monthly-discounts` nem `revertSubscriptionValueIfDiscounted` (escopo separado).
- Não crio migration Lovable (backend self-hosted — vai SQL pro Studio).
- Não mexo em SMTP / templates de email.

## Bloco final de deploy (vai no fim da próxima rodada)

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh asaas-webhook
```

E você roda o SQL no Studio antes do deploy (pra tabela existir quando a function nova subir).

## Confirma?

Se topar, próxima rodada já vem:
1. SQL completo (tabela + seed + audit) em `/mnt/documents/`
2. `asaas-webhook/index.ts` reescrito
3. Bloco de deploy

Depois disso você roda o reprocess da thalyson via curl e o estado dela fica 100% correto sem digitar nada manual.