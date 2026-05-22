# Presente travado por 8 dias — anti-chargeback

Substituir o `<HypeOfTheDay />` no painel principal (`src/pages/Index.tsx`) por um card de "presente bloqueado", dourado pulsante com cadeado e contador regressivo. Quando faltarem 0 dias, o componente original (que vai virar as Trends Virais do YouTube com thumbnails) volta a renderizar normalmente.

A "data zero" do contador é a data do **primeiro `PAYMENT_RECEIVED` confirmado** pelo webhook Asaas — não a criação da conta, não a criação do customer. Isso garante que reembolso/chargeback antes do D8 nunca dá acesso ao bônus.

---

## Por que essa abordagem reduz chargeback

1. O Asaas/cartão tem janela típica de contestação inicial de ~7 dias quando o motivo é "não reconheço" / "não recebi o produto". Travar um bônus visível, alto-valor-percebido, até o D8 cria um **incentivo para o usuário esperar** em vez de contestar.
2. O contador pulsante dourado vira reforço positivo diário ("falta menos") em vez de fricção.
3. Como TUDO mais (análise, matriz, tarefas, chat, guias) fica liberado de cara, a retenção dos primeiros dias não cai — só atrasamos o item bônus.

---

## O que muda

### 1. Backend (SQL pro Studio self-hosted)

Adicionar coluna `first_paid_at` em `subscription_state` e popular no webhook na PRIMEIRA confirmação de pagamento.

```sql
ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS first_paid_at timestamptz;

-- backfill: pega a data do primeiro PAYMENT_RECEIVED de cada user nos eventos arquivados
UPDATE public.subscription_state ss
SET first_paid_at = sub.first_paid
FROM (
  SELECT
    (payload->'payment'->>'customer') AS asaas_customer_id,
    MIN(created_at) AS first_paid
  FROM public.asaas_webhook_events
  WHERE event_type = 'PAYMENT_RECEIVED'
  GROUP BY 1
) sub
WHERE ss.asaas_customer_id = sub.asaas_customer_id
  AND ss.first_paid_at IS NULL;
```

### 2. Edge function `asaas-webhook`

No handler de `PAYMENT_RECEIVED`, antes do UPDATE de `subscription_state`, fazer:

```ts
// se first_paid_at ainda for NULL, gravar agora
update.first_paid_at = existing.first_paid_at ?? new Date().toISOString();
```

(só seta na primeira vez; idempotente nas confirmações seguintes)

### 3. Frontend — novo componente `GiftUnlockCard.tsx`

`src/components/GiftUnlockCard.tsx`:

- Lê `subscription_state.first_paid_at` do user logado (via hook `useSubscription` — já existe; basta expor o campo).
- Calcula `daysRemaining = ceil((first_paid_at + 8d − now) / 1d)`.
- Se `daysRemaining > 0` → renderiza o card dourado bloqueado.
- Se `daysRemaining <= 0` ou `first_paid_at` é null mas `is_premium=true` por bypass manual da equipe → renderiza `<HypeOfTheDay />`.

Visual do card bloqueado:
- Borda dourada degradê (`from-amber-400 via-yellow-300 to-amber-500`), animação `animate-pulse` suave (2s).
- Centro: ícone `Gift` grande (Lucide) com um `Lock` sobreposto no canto inferior direito.
- Texto principal: **"Temos um presente pra você 🎁"**
- Subtítulo: **"Liberado em {N} dias · Trends Virais do YouTube com thumbnails"**
- Contador grande tipográfico (`font-display`) mostrando `Xd Yh Zm`, atualizando a cada minuto via `setInterval`.
- Glow externo dourado pulsante (`box-shadow` animado).

Estado "quase liberado" (≤24h):
- Troca para "Liberando amanhã! ⏰" e contagem em horas/minutos só.

Estado "liberado" (passa para `<HypeOfTheDay />` automaticamente).

### 4. Integração

Em `src/pages/Index.tsx`:
```diff
- <HypeOfTheDay />
+ <GiftUnlockCard />
```

`GiftUnlockCard` decide internamente se mostra o card travado ou o `<HypeOfTheDay />` real.

### 5. Hook `useSubscription`

Adicionar `firstPaidAt: string | null` ao retorno (já buscamos a row, só expor o campo).

---

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Usuário em trial legado (sem pagamento ainda) | Card travado mostra "Disponível após sua primeira assinatura confirmada" sem contador |
| 4 users premium manuais (equipe, sem `asaas_customer_id`) | Liberado direto — `is_premium=true && first_paid_at IS NULL && asaas_customer_id IS NULL` → mostra `HypeOfTheDay` |
| Webhook PAYMENT_RECEIVED chega 2x | `first_paid_at = existing ?? now()` garante idempotência |
| Backfill | SQL preenche para usuários já pagantes; eles vão ver o presente já liberado (correto, pois já passaram do D8) |

---

## Arquivos

**Criar**
- `src/components/GiftUnlockCard.tsx`

**Editar**
- `src/pages/Index.tsx` (1 linha: trocar componente)
- `src/hooks/useSubscription.ts` (expor `firstPaidAt`)
- `supabase/functions/asaas-webhook/index.ts` (setar `first_paid_at` na 1ª confirmação)

**SQL pro user rodar no Studio self-hosted**
- ALTER TABLE + backfill (bloco acima)

**Deploy**
- Frontend: auto Vercel ao mergear no `main`
- Edge function: `./scripts/deploy-selfhost.sh asaas-webhook` na VPS

---

## Texto sugerido pro card (pode iterar depois)

> 🎁 **Temos um presente pra você**
> Liberando em **6d 12h 34m**
> _Trends Virais do YouTube com thumbnails ao vivo_

Sutil e gera FOMO positivo sem prometer demais.
