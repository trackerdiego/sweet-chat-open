# Plano: Influ Coins + Indicação + Trial de 7 dias

## Decisões aprovadas
- **Trial:** 7 dias pra todos (free atuais ganham 7 dias a partir do deploy; novos signups ganham 7 dias)
- **Desconto:** automático via Asaas API (PATCH na subscription antes do vencimento)
- **Indicação:** crédito liberado no `PAYMENT_CONFIRMED` da 1ª fatura do indicado

---

## 1. Schema do banco (SQL pra rodar no Studio self-hosted)

### `user_wallet` — saldo de coins e créditos
```text
user_id (PK, FK auth.users)
coins_balance int default 0          -- coins não convertidos
credits_balance_cents int default 0  -- créditos R$ de indicação (em centavos)
total_coins_earned int default 0     -- métrica vitalícia
total_credits_earned_cents int default 0
updated_at timestamptz
```

### `coin_transactions` — log de tudo
```text
id, user_id, amount (pos/neg), type, reference_id, description, created_at
type: 'task_complete' | 'streak_bonus' | 'monthly_redeem' | 'admin_adjust'
```

### `referral_codes` — código único por user
```text
user_id (PK), code text unique (slug ex: 'joao-x7k2'), created_at
```

### `referrals` — rastreio de quem indicou quem
```text
id, referrer_user_id, referred_user_id (unique),
status: 'pending' | 'paid' | 'reversed',
referrer_credit_cents int default 1500,  -- R$15
referred_discount_pct int default 15,
signup_at, first_payment_at, credited_at
```

### `subscription_state` — fonte da verdade do plano
```text
user_id (PK), status: 'trial' | 'active' | 'past_due' | 'canceled',
trial_ends_at timestamptz,
asaas_subscription_id, asaas_customer_id,
plan: 'monthly' | 'yearly',
next_due_date date, current_period_end timestamptz,
discount_applied_cents int default 0,  -- desconto na próxima fatura
discount_applied_for_due_date date     -- evita aplicar 2x
```

### `monthly_redemptions` — histórico de desconto aplicado
```text
id, user_id, asaas_payment_id, due_date,
coins_used int, credits_used_cents int,
discount_total_cents int, applied_at
```

**Trigger no signup** (novo `handle_new_user`): cria `user_wallet`, `referral_codes` (gerar slug do display_name + 4 chars random), `subscription_state` com `trial_ends_at = now() + 7 days`.

**Migration de dados existentes:** popular `user_wallet`, `referral_codes`, `subscription_state` pra todos os users já cadastrados. Free atuais → `trial_ends_at = now() + 7 days`. Premium atuais → `status = 'active'` puxando do `user_usage.is_premium`.

---

## 2. Edge functions novas

### `award-task-coins` (chamada pelo frontend ao concluir tarefa)
- Input: `{ day, taskIndex }`
- Valida que tarefa não foi premiada antes (lê `user_progress.tasks_completed`)
- Insere `+10` em `coin_transactions`, atualiza `user_wallet`
- Se completou 7 dias seguidos de streak → `+50` bonus

### `apply-monthly-discount` (cron diário às 6h)
- Roda `pg_cron` chamando essa function
- Busca `subscription_state` onde `next_due_date = today + 2` e `discount_applied_for_due_date != next_due_date`
- Calcula: `coins_balance / 100 * 100` (em centavos, max 50% do plano) + `credits_balance_cents` (até zerar a fatura)
- Chama `PATCH /subscriptions/{id}` no Asaas com novo `value` reduzido
- Insere em `monthly_redemptions`, zera coins/créditos usados em `user_wallet`, marca `discount_applied_for_due_date`

### `get-referral-info` (chamada pelo frontend na tela "Indique e ganhe")
- Retorna: `{ code, link, total_referrals, paid_referrals, pending_credits_cents, available_credits_cents }`

### Modificar `asaas-webhook`
- No `PAYMENT_CONFIRMED`: se for 1ª fatura paga do user E existe `referrals` com `referred_user_id = user` e `status = 'pending'`:
  - marca `status = 'paid'`, `credited_at = now()`
  - credita `referrer_credit_cents` em `user_wallet.credits_balance_cents` do indicador
  - registra em `coin_transactions` (type `referral_paid`)
- No `PAYMENT_REFUNDED` ou `SUBSCRIPTION_CANCELLED` da 1ª fatura: marca referral como `reversed`, debita do indicador (se ainda não usou)

### Modificar `create-asaas-subscription`
- Aceitar `referralCode` opcional no body
- Se válido: cria registro em `referrals` com `status='pending'` E aplica `discount: { value: plano*0.15, dueDateLimitDays: 0 }` na 1ª fatura via Asaas

### Cron `pg_cron`
```text
- apply-monthly-discount: diário 06:00
- expire-trials: diário 03:00 (atualiza subscription_state pra 'past_due' onde trial_ends_at < now())
```

---

## 3. Frontend

### Hook novo `useSubscription()`
Substitui `useUserUsage` pra checagem de acesso. Retorna:
```text
{ status, isActive, isTrial, trialDaysLeft, plan, blocked }
```
`blocked = true` quando `status` é `past_due`/`canceled` e trial expirou.

### Hook novo `useWallet()`
Retorna `{ coinsBalance, creditsBalanceCents, transactions[] }` + função `refresh()`.

### Componente `<PaywallGate>`
Wrapper que envolve toda a área autenticada. Se `blocked` → renderiza tela cheia com:
- "Seu trial acabou. Continue acessando o InfluLab Pro"
- 2 cards (mensal/anual com badge "Economize 30%")
- Botão abre `<CheckoutModal>`
- Sem opção de fechar/skip

### Tela `/indique` (nova rota)
- Card grande com link `app.influlab.pro/?ref=CODE` + botão copiar
- Botão "Compartilhar" usando Web Share API
- Mensagens prontas pra WhatsApp/Instagram (textarea editável)
- Estatísticas: "X amigos assinaram • R$Y de crédito disponível"
- Lista das últimas indicações com status (pendente/paga)
- Card explicativo: "Ganhe R$15 a cada amigo que assinar. Eles ganham 15% off."

### Tela `/carteira` (nova rota) ou drawer
- Saldo de coins + equivalente em R$
- Saldo de créditos
- "Próximo desconto: R$X aplicado em DD/MM"
- Histórico de transações

### Modificar `<TaskChecklist>`
- Ao marcar tarefa: chama `award-task-coins`, mostra toast "+10 coins" com animação
- Indicador de coins ganhos hoje no topo

### Modificar `<Navigation>`
- Novo item "Indique e ganhe" com badge se tem créditos pendentes
- Mostrar saldo de coins no header (clicável → /carteira)

### Modificar `Auth.tsx` (signup)
- Ler `?ref=CODE` da URL → salvar em `localStorage` antes do signup
- Após signup bem-sucedido: enviar `referralCode` na criação do subscription
- Mostrar banner "Você foi indicado por @joao — ganhe 15% off na 1ª mensalidade"

### Modificar `CheckoutModal`
- Atualizar valor anual (R$397 já está, manter)
- Mostrar parcelamento "12x R$33 com juros no cartão" como info
- Se tem `referralCode` no localStorage → exibir desconto aplicado

### Remover lógica freemium
- `useUserUsage`: deprecar `canUseScript/canUseTool/canTranscribe/canUseChat/canAccessDay/FREE_LIMITS`
- Em todas as telas que usam essas flags: trocar por `useSubscription().isActive`
- Componente `<PremiumGate>`: simplificar pra só checar `isActive`
- `<Rifometro>` de tarefas: remover indicador de "X de 3 hoje"

---

## 4. Admin panel
- Nova aba "Economia": top 10 indicadores, total coins emitidos no mês, total descontos aplicados
- Drawer do user: mostrar saldo wallet, indicações, histórico de redenções

---

## 5. Detalhes técnicos importantes

### Geração de código de indicação
```text
slug(display_name).slice(0,8) + '-' + random(4chars)
ex: "joao-x7k2", "maria-9hbn"
```
Garantir unicidade via UNIQUE constraint + retry.

### Anti-fraude básico
- 1 indicação por email único (UNIQUE em `referrals.referred_user_id`)
- Self-referral bloqueado (check `referrer_user_id != referred_user_id`)
- Crédito só libera após `PAYMENT_CONFIRMED`, não em `PAYMENT_CREATED`

### Cron de desconto — fórmula
```text
plan_value_cents = 4700 (mensal) ou 39700 (anual)
max_discount_cents = plan_value_cents * 0.5
coins_value_cents = floor(coins_balance / 100) * 100
discount = min(coins_value_cents + credits_balance_cents, max_discount_cents)
new_value_cents = plan_value_cents - discount
```

### Self-hosted deploy
- SQL completo entregue como bloco copia-e-cola pro Studio
- Edge functions deployadas via `./scripts/deploy-selfhost.sh`
- pg_cron precisa estar habilitado no self-hosted (verificar)

---

## 6. Ordem de implementação

1. SQL: criar tabelas + trigger + migration de dados existentes
2. Edge function `award-task-coins` + integração no `<TaskChecklist>`
3. Hook `useSubscription` + `<PaywallGate>` + remoção freemium
4. Tela `/carteira` + hook `useWallet`
5. `referral_codes` + tela `/indique` + edge `get-referral-info`
6. Captura `?ref=` no signup + modificação `create-asaas-subscription`
7. Webhook Asaas: lógica de crédito de indicação
8. Cron `apply-monthly-discount` + função
9. Cron `expire-trials`
10. Admin panel: aba Economia
11. QA completo + bloco SQL/deploy final

---

## O que NÃO está no escopo (pra próxima fase)
- Gastar coins em outras coisas (templates premium, análise extra, etc.)
- Níveis de embaixador (R$15 → R$25 → R$50 conforme volume)
- Gamificação de medalhas/badges visuais
- Notificação push de "amigo seu acabou de assinar!"
- Dashboard público de ranking de indicadores

---

## Estimativa
- ~14 arquivos editados/criados no frontend
- 5 edge functions novas + 2 modificadas
- 1 bloco SQL grande (6 tabelas + trigger + migration + 2 cron jobs)
- Bloco final de deploy VPS

Aprova esse plano pra eu começar a implementar?