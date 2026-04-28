
## Fase 2 — Carteira, Indicações e Sincronização de Assinatura

Objetivo: deixar o sistema de coins/indicações **visível e funcional ponta a ponta**, e fazer o `subscription_state` ser a fonte da verdade real (não só `user_usage.is_premium`). Ainda **sem paywall** e **sem desconto automático no Asaas** (isso fica pra Fase 3).

---

### 1. Páginas novas

#### `/carteira` (`src/pages/Wallet.tsx`)
- Cabeçalho com saldo grande: `🪙 {coins_balance}` + sub-linha "≈ R$ X,XX em desconto" (1 coin = R$ 0,01, taxa de conversão definida em constante `COIN_TO_BRL = 0.01`).
- Card "Créditos de indicação": `R$ {referral_credits_brl}` separado dos coins (caminho diferente — vem de indicação paga).
- Lifetime: "Total ganho desde sempre: {lifetime_coins_earned} coins".
- Lista das últimas 20 `coin_transactions` (já vem do `useWallet`): ícone por tipo, label PT-BR (`task_complete` → "Tarefa concluída", `streak_bonus` → "Bônus de streak 7 dias", `referral_bonus` → "Indicação paga", `redeem_discount` → "Desconto aplicado"), data relativa ("há 2h"), valor (+/-).
- Banner suave no topo: "Use seus coins pra ganhar desconto na mensalidade — Em breve" (não funcional na Fase 2, só sinalização).
- Link/CTA "Indique amigos →" que vai pra `/indique`.

#### `/indique` (`src/pages/Referral.tsx`)
- Card grande com o código do usuário (lido de `referral_codes`): `INFLU-XYZ123`.
- Link compartilhável pré-formado: `https://app.influlab.pro/auth?ref=XYZ123`.
- Botão "Copiar link" (clipboard API + toast).
- Botões de share nativos (WhatsApp, Telegram) usando `window.open` com mensagens prontas.
- Explicação curta: "Quando seu indicado pagar a 1ª mensalidade, você ganha **R$ 10 em créditos** (creditados automaticamente aqui)."
- Lista de indicações do usuário (via `referrals` onde `referrer_id = auth.uid()`): nome mascarado (`Maria S.` — cruzar com `user_profiles.display_name`), status (`pending` → "Aguardando 1º pagamento", `paid` → "✅ Pagou — você ganhou R$ 10", `expired` → "Expirou").
- Contador no topo: "X indicações pagas · R$ Y ganhos".

#### Rotas em `App.tsx`
- Adicionar `/carteira` → `<Wallet/>` e `/indique` → `<Referral/>` (ambas autenticadas).

#### Hook `useReferrals` novo
- Lê `referral_codes` (próprio) e `referrals where referrer_id = uid` com join opcional pra display_name.
- Expõe `code`, `referrals[]`, `paidCount`, `totalEarnedBrl`.

---

### 2. Captura de `?ref=` no signup (`src/pages/Auth.tsx`)

Mudança mínima e segura:
- Ao montar `Auth`, ler `?ref=` da URL e salvar em `localStorage.setItem('pending_ref', code)` (TTL implícito: dura até o signup).
- No `handleSubmit` do **signup** (não do login), depois do `signUp` retornar com sucesso (com ou sem session), chamar nova edge function `register-referral` com `{ code }` no body. Ela valida o código, cria a row em `referrals` (status `pending`), e limpa o localStorage.
- Se o código for inválido, ignora silenciosamente (não bloqueia signup — referral é bônus).
- Mostra um banner pequeno acima do form: "🎁 Você foi convidado por @{nome do referrer}" quando `?ref=` está presente e válido (resolve via SELECT em `referral_codes` join `user_profiles`).

#### Edge function `register-referral`
- Pequena, síncrona (<300ms).
- Body: `{ code: string }`.
- Valida JWT do usuário recém-cadastrado.
- SELECT em `referral_codes` por `code` → pega `referrer_id`.
- Guarda contra auto-indicação (`referrer_id !== user.id`).
- Guarda contra duplicata (constraint `unique(referred_user_id)` — vou pedir SQL extra, ver seção 5).
- INSERT em `referrals` com `status='pending'`, `referred_code=code`.
- Retorna `{ ok: true }`.

---

### 3. Sincronização `subscription_state` no fluxo de pagamento

O webhook hoje só mexe em `user_usage.is_premium`. Vamos espelhar tudo em `subscription_state` E processar indicação no 1º pagamento.

#### `create-asaas-subscription/index.ts`
- Após criar a assinatura no Asaas, **upsert** em `subscription_state`:
  - `status` permanece `trial` (só vira `active` quando o webhook confirma pagamento).
  - `asaas_subscription_id` = `subscriptionData.id`.
  - `asaas_customer_id` = `customerId`.
  - `plan` = `'monthly' | 'yearly'`.

#### `asaas-webhook/index.ts` — em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`:
1. Mantém o update em `user_usage.is_premium = true` (compatibilidade — `useUserUsage` ainda é usado em vários lugares).
2. Upsert em `subscription_state`: `status='active'`, `current_period_end = nextDueDate da subscription` (busca via API Asaas — já tá fazendo fetch do sub quando precisa).
3. **Processamento de indicação (idempotente):**
   - SELECT em `referrals` onde `referred_user_id = userId AND status = 'pending'`.
   - Se achou: UPDATE pra `status='paid'`, `first_payment_at=now()`, `credit_awarded_brl=10`.
   - Credita R$ 10 no wallet do referrer: UPDATE `user_wallet SET referral_credits_brl = referral_credits_brl + 10` onde `user_id = referrer_id`.
   - Loga em `coin_transactions` do referrer (type=`referral_bonus`, amount=`0` — coins não, é credit BRL — com `metadata: {credit_brl: 10, referral_id}` e `reference_id='referral-{referral_id}'` pra idempotência).
   - Idempotente: a query `WHERE status='pending'` garante que só corre uma vez (no 2º payment_confirmed o status já é `paid`).

#### Eventos de falha (`PAYMENT_OVERDUE`, etc.):
- Mantém `user_usage.is_premium=false`.
- Upsert `subscription_state.status='past_due'` (ou `canceled` em SUBSCRIPTION_DELETED).

---

### 4. Indicador na navegação

- Adicionar item no DropdownMenu de Config: "🎁 Indicar amigos" → navega pra `/indique`.
- Adicionar item: "💰 Carteira" → navega pra `/carteira` (substitui o item disabled atual que só mostra coins).
- Manter o badge de coins no trigger do dropdown (já existe).

---

### 5. SQL adicional pro Studio self-hosted

Bloco SQL pequeno pra rodar no api.influlab.pro:

```sql
-- Garante 1 indicação por usuário (não pode ter sido indicado por 2 pessoas)
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referred_user_unique UNIQUE (referred_user_id);

-- Idempotência da credit log de indicação
ALTER TABLE public.coin_transactions
  ADD CONSTRAINT coin_tx_user_ref_unique UNIQUE (user_id, reference_id);
-- (talvez já exista da Fase 1 — IF NOT EXISTS via DO block pra ser safe)
```

A constraint de `coin_transactions` provavelmente já foi criada na Fase 1 (a função `award_task_coins` usa `ON CONFLICT (user_id, reference_id)`); o SQL vai ser entregue com `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` pra não quebrar.

---

### 6. O que NÃO entra nesta fase

- ❌ Paywall global / bloqueio após trial expirar
- ❌ Aplicação automática de desconto na fatura Asaas (PATCH no `value` da subscription)
- ❌ Cron mensal de redenção
- ❌ Remoção do `useUserUsage`/`FREE_LIMITS` (mantido pra retrocompatibilidade)
- ❌ Notificação push avisando "indicação pagou" (entra na Fase 3 se fizer sentido)

---

### 7. Entregáveis ao final da Fase 2

1. `src/pages/Wallet.tsx` + `src/pages/Referral.tsx` + rotas no App.tsx
2. `src/hooks/useReferrals.ts`
3. Edge function nova `register-referral`
4. `asaas-webhook/index.ts` atualizado (sub-state sync + processa indicação paga)
5. `create-asaas-subscription/index.ts` atualizado (upsert sub-state)
6. `src/pages/Auth.tsx` com captura de `?ref=` + banner de convite
7. Navigation com links pra Carteira/Indique
8. Bloco SQL pro Studio + comando bash de deploy pra VPS

---

### Riscos / atenção

- **Idempotência da indicação**: garantida por `WHERE status='pending'` no UPDATE + `unique(user_id, reference_id)` em `coin_transactions`. Mesmo se o webhook duplicar, o UPDATE não acha row pra atualizar na 2ª vez.
- **Auto-indicação**: bloqueada na edge function `register-referral` (`referrer_id !== user.id`).
- **Código inválido**: signup nunca falha por causa de ref ruim — log + ignore.
- **Backfill**: usuários atuais não têm indicação registrada — tudo bem, sistema começa a contar dos novos signups.
- **Premium atual virando active no sub-state**: já foi feito na Fase 1 via migration. Novos pagamentos atualizam normal.
- **`subscription_state` vs `user_usage.is_premium`**: ambos vão coexistir. Frontend de paywall (Fase 3) lerá `subscription_state`. Hooks atuais (`useUserUsage`) continuam vendo `is_premium`.

Aprova pra eu começar a implementar?
