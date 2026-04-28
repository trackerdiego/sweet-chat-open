
# Experiência de cobrança Pix recorrente no app

Hoje quando o Pix do cliente vence, ele descobre que perdeu acesso só ao abrir o app — e cai num checkout que cria assinatura nova (duplica cobrança no Asaas). Plano resolve isso com 4 frentes integradas: banner pré-vencimento, tela de renovação com QR da fatura real, push notifications e aplicação automática de coins no momento do bloqueio.

## Visão geral do fluxo novo

```text
Asaas gera cobrança Pix (PAYMENT_CREATED webhook)
        │
        ▼
  subscription_state.next_invoice = { id, value, due_date, pix_qr, pix_copy_paste, payment_url }
        │
        ├─ 3 dias antes: cron dispara push #1 + banner aparece no app
        ├─ 1 dia antes:  cron dispara push #2
        └─ no vencimento: cron dispara push #3
        │
        ▼
Cliente clica banner/push → /renovar
        │
        ├─ Mostra QR Pix da fatura real (não cria nova)
        ├─ Se tiver coins → aplica desconto AGORA (PATCH valor + gera novo QR)
        └─ Botão secundário "trocar para cartão"
        │
        ▼
Cliente paga → webhook PAYMENT_RECEIVED → status='active' → next_invoice limpo
```

## Arquivos novos

**Backend (edge functions)**
- `supabase/functions/get-pending-invoice/index.ts` — retorna a fatura Pix pendente do usuário com QR atualizado, aplicando coins automaticamente se houver saldo. Usa lógica de `apply-monthly-discounts` (PATCH valor + monthly_redemptions pra idempotência).
- `supabase/functions/switch-to-credit-card/index.ts` — PATCH `billingType: CREDIT_CARD` na subscription Asaas existente + retorna URL de checkout pro cliente cadastrar cartão.
- `supabase/functions/notify-pix-due-soon/index.ts` — cron diário que varre `subscription_state.next_invoice` e dispara pushes nas janelas (3d, 1d, 0d). Idempotência via campo `notifications_sent` no JSON.

**Frontend**
- `src/pages/Renew.tsx` — tela `/renovar`: QR code grande + copia-cola + countdown + botão "trocar pra cartão" + breakdown do desconto se aplicado.
- `src/components/PixDueBanner.tsx` — banner global no topo (acima da Navigation) que só aparece se `next_invoice.due_date` ≤ 3 dias e `is_paid=false`.
- `src/hooks/usePendingInvoice.ts` — hook que lê `subscription_state.next_invoice` e expõe `{ invoice, daysUntilDue, hasUrgentInvoice, refresh }`.

## Arquivos modificados

- `supabase/functions/asaas-webhook/index.ts` — novos handlers:
  - `PAYMENT_CREATED` (Pix): popula `subscription_state.next_invoice` com `{ asaas_payment_id, value, due_date, pix_qr_code, pix_copy_paste, payment_url, billing_type:'PIX' }`.
  - `PAYMENT_RECEIVED`: limpa `next_invoice = null` (já existe lógica de renovar período, só adicionar o clear).
  - `PAYMENT_DELETED` / `PAYMENT_REFUNDED`: limpa também.
- `src/components/AccessGuard.tsx` — quando `status='past_due'` redireciona pra `/renovar` em vez de abrir CheckoutModal. CheckoutModal continua só pra usuários novos sem assinatura.
- `src/App.tsx` — adicionar rota `/renovar` (acessível mesmo com `past_due`, igual `/carteira`).
- `src/components/Navigation.tsx` ou layout root — montar `<PixDueBanner />` acima.
- `src/hooks/useSubscription.ts` — incluir `next_invoice` no retorno.

## Mudanças de schema (SQL pro Studio self-hosted)

```sql
-- 1. Coluna next_invoice em subscription_state
ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS next_invoice jsonb;

-- Estrutura esperada do JSON:
-- {
--   "asaas_payment_id": "pay_xxx",
--   "value": 47.00,
--   "original_value": 47.00,
--   "due_date": "2026-05-05",
--   "billing_type": "PIX",
--   "pix_qr_code": "data:image/png;base64,...",
--   "pix_copy_paste": "00020126...",
--   "payment_url": "https://www.asaas.com/i/xxx",
--   "discount_applied": { "coins_used": 0, "credits_used_brl": 0, "discount_brl": 0 },
--   "notifications_sent": { "d3": false, "d1": false, "d0": false },
--   "is_paid": false,
--   "updated_at": "2026-04-28T..."
-- }

CREATE INDEX IF NOT EXISTS idx_subscription_state_next_invoice_due
  ON public.subscription_state ((next_invoice->>'due_date'))
  WHERE next_invoice IS NOT NULL;

-- 2. Cron diário (rodar via crontab da VPS, mesmo padrão do apply-monthly-discounts)
-- Adicionar no crontab:
-- 0 9 * * * curl -s -X POST https://api.influlab.pro/functions/v1/notify-pix-due-soon \
--   -H "Authorization: Bearer $CRON_SECRET"
```

## Decisão sobre coins (confirmada)

- **`get-pending-invoice` aplica coins automaticamente na primeira chamada**: se `monthly_redemptions` ainda não tem registro pra esse `period_month`, calcula desconto (mesma fórmula do cron — créditos primeiro, depois coins, teto 50%, nunca zerar), faz PATCH no valor da fatura Asaas, busca QR novo, debita wallet, registra redemption, retorna invoice já com desconto.
- **Próximas chamadas do mesmo período**: vê que já tem redemption, retorna invoice como está (idempotente).
- **Cliente sem coins**: pula direto pra retornar invoice com valor cheio.
- **Casos não-past_due**: cron `apply-monthly-discounts` continua rodando 2 dias antes do vencimento como hoje (não muda nada). A lógica do `get-pending-invoice` é safety net pra quem ficou past_due antes do cron rodar (ex: Pix venceu de manhã, cron roda à noite).

Resultado: **coins aplicam em 100% dos cenários de renovação** (mensal automático via cron, mensal manual via /renovar, anual via cron). Primeira compra continua sem coins (cliente novo nem tem saldo).

## Push notifications (3 toques)

`notify-pix-due-soon` lê `next_invoice` e dispara via `send-push` (já existe):
- **D-3 (3 dias antes)**: "Sua fatura de R$X vence em 3 dias. Toque pra pagar agora."
- **D-1**: "Sua fatura vence amanhã. Não perca acesso ao InfluLab."
- **D-0 (vencimento)**: "Última chamada — sua assinatura vence hoje."

Cada disparo marca `notifications_sent.d3 = true` no JSON pra idempotência (cron pode rodar várias vezes sem repetir).

## Banner pré-vencimento (só Pix pendente)

Componente `PixDueBanner` aparece se:
- `next_invoice` existe E
- `billing_type === 'PIX'` E
- `is_paid === false` E
- `daysUntilDue <= 3`

Conteúdo: "Sua fatura Pix de R$X vence em N dias → [Pagar agora]" → leva pra `/renovar`. Cor: amber em D-3/D-2, vermelho em D-1/D-0. Dispensa-se ao pagar (webhook limpa `next_invoice`).

## Tela /renovar

Layout mobile-first com glassmorphism (padrão do projeto):
1. Header: "Renove sua assinatura" + countdown ("vence em 2 dias")
2. Card central: QR Code grande + copia-cola com botão de copiar
3. Se desconto aplicado: badge "Você economizou R$X com suas coins" + breakdown (valor original riscado → novo valor)
4. Botão primário: "Abrir no banco" (`window.open(payment_url)`)
5. Botão secundário: "Prefere cartão? Trocar agora" → confirma → chama `switch-to-credit-card` → abre URL Asaas
6. Polling a cada 10s pra detectar pagamento (refresh `subscription_state` → se `status='active'` redireciona pra `/`)

## Detalhes técnicos

**Idempotência do desconto no /renovar**
A função `get-pending-invoice` usa o mesmo guard de `monthly_redemptions(user_id, period_month)`. Se o cron `apply-monthly-discounts` já aplicou pra esse período, `get-pending-invoice` não aplica de novo — só lê o valor atual da fatura Asaas e retorna.

**Webhook PAYMENT_CREATED**
Asaas envia esse webhook quando gera nova cobrança Pix (todo ciclo). Payload já vem com `payment.id`, `payment.value`, `payment.dueDate`, `payment.billingType`. Pra QR Pix, tem que fazer GET adicional em `/payments/{id}/pixQrCode` (Asaas não manda no webhook). Esse GET fica dentro do handler.

**Troca pra cartão**
PATCH em `/subscriptions/{id}` com `billingType: CREDIT_CARD` + `creditCard` data exige tokenização. Mais simples: gerar nova fatura cartão pra cobrança pendente (`POST /payments` com `billingType: CREDIT_CARD` referenciando a subscription) e retornar `invoiceUrl` — Asaas hospeda formulário seguro de cartão. Após pagamento, futuras cobranças automáticas no cartão tokenizado.

**Push fallback iOS**
Já existe lógica em `usePushNotifications`. Pra quem não tem push ativo, banner + email do Asaas (já configurado no painel) cobrem.

**Modo cron seguro**
`notify-pix-due-soon` valida `Authorization: Bearer ${CRON_SECRET}` igual `apply-monthly-discounts`.

## Plano de deploy (VPS)

Toda mudança vai pro repo `/root/app` via Lovable→GitHub. Após merge:

```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh \
  asaas-webhook \
  get-pending-invoice \
  switch-to-credit-card \
  notify-pix-due-soon
```

SQL `ALTER TABLE` roda manualmente no Studio self-hosted (https://studio.api.influlab.pro). Crontab na VPS recebe linha nova pro `notify-pix-due-soon` rodar diariamente às 09:00.

## O que NÃO entra agora

- Pix Automático do BC (em piloto, Asaas ainda não expôs em produção). Quando liberar, é só mudar `billingType` na criação da subscription e o fluxo manual deixa de ser necessário pra recorrência cartão-like.
- Notificações nativas Asaas (email/SMS/WhatsApp) — você ativa direto no painel Asaas, não precisa código. Recomendo ativar email pelo menos como backup.
- Tela de histórico de faturas pagas (já tem dado em `coin_transactions` + Asaas, fica pra outra entrega).

## Aprovação

Aprova e eu implemento tudo de uma vez? Resposta vai terminar com o bloco copia-e-cola pra rodar na VPS (SQL + deploy script + linha do crontab).
