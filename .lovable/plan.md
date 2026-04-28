## Fase 1 — Fundação: Schema + Coins por Tarefa

Objetivo: criar toda a base de dados (carteira, coins, indicações, assinatura/trial) e fazer o usuário começar a ganhar **+10 coins por tarefa concluída** já visível na UI. Sem mexer ainda em paywall ou indicações (isso é Fase 2/3).

---

### 1. SQL único pro Studio self-hosted

Vou entregar **um bloco SQL** pra você colar no SQL Editor do `api.influlab.pro`. Cria 6 tabelas + RLS + índices + função SECURITY DEFINER pra creditar coins atomicamente.

**Tabelas:**
- `subscription_state` — `user_id`, `status` (`trial`|`active`|`past_due`|`canceled`), `trial_ends_at`, `current_period_end`, `asaas_subscription_id`, `plan` (`monthly`|`annual`)
- `user_wallet` — `user_id`, `coins_balance`, `referral_credits_brl`, `lifetime_coins_earned`
- `coin_transactions` — `user_id`, `amount`, `type` (`task_complete`|`streak_bonus`|`redeem_discount`|`adjust`), `reference_id`, `metadata`, `created_at`
- `referral_codes` — `user_id`, `code` (slug único), `created_at`
- `referrals` — `referrer_id`, `referred_user_id`, `referred_code`, `status` (`pending`|`paid`|`expired`), `first_payment_at`, `credit_awarded_brl`
- `monthly_redemptions` — `user_id`, `period_month` (YYYY-MM), `coins_used`, `credits_used_brl`, `discount_brl_total`, `applied_at` — garante 1 aplicação/mês

**Função:**
- `award_task_coins(p_user_id uuid, p_day int, p_task_id text, p_amount int)` — insere em `coin_transactions` + atualiza `user_wallet.coins_balance`/`lifetime`. Idempotente por `(user_id, reference_id)` pra evitar dupla contagem se a tarefa for desmarcada/remarcada.

**Migração de dados:**
- Pra cada usuário existente em `user_usage`:
  - Se `is_premium = true` → `subscription_state.status = 'active'`, sem `trial_ends_at`.
  - Se `is_premium = false` → `subscription_state.status = 'trial'`, `trial_ends_at = now() + 7 days`.
- Cria `user_wallet` zerado pra todos.
- Gera `referral_codes` único pra todos (slug curto baseado em nanoid/substring do uuid).

**RLS:** usuário lê só o próprio (`auth.uid() = user_id`). Service role faz tudo. Writes em wallet/transactions só via service role (edge function) — frontend nunca escreve direto.

---

### 2. Edge Function nova: `award-task-coins`

Padrão simples (não precisa de async job — operação rápida, <500ms):
- Recebe `{ day: number, taskId: string }`.
- Chama RPC `award_task_coins` com `reference_id = "day-{day}-task-{taskId}"`.
- Detecta streak: lê `user_progress.streak`; se múltiplo de 7, credita +50 bônus com `reference_id = "streak-{streak}"`.
- Retorna `{ coinsAwarded, newBalance, streakBonus }`.

Deploy via `./scripts/deploy-selfhost.sh award-task-coins` (vou entregar o comando pronto no fim).

---

### 3. Frontend: `useWallet` hook + integração no TaskChecklist

**Novo hook** `src/hooks/useWallet.ts`:
- Lê `user_wallet` do usuário (saldo de coins + créditos R$).
- Lê últimas 20 `coin_transactions` pra histórico.
- Expõe `refreshWallet()` pra chamar após premiar.

**Mudança em `TaskChecklist.tsx`:**
- Quando o usuário marca uma tarefa como concluída, depois do update local em `user_progress`, chama `supabase.functions.invoke('award-task-coins', { body: { day, taskId } })`.
- Se sucesso: toast "+10 coins" (ou "+60 coins" se houve bônus de streak).
- Chama `refreshWallet()`.
- Tratamento de erro silencioso (não bloqueia a UX da tarefa — coins são bônus).

**Indicador visual leve no header** (`Navigation.tsx` ou onde fica o `StreakCounter`):
- Pequeno badge `🪙 {coinsBalance}` clicável que por enquanto não navega pra lugar nenhum (rota `/carteira` chega na Fase 2). Apenas mostra que o sistema tá vivo.

---

### 4. O que NÃO entra nesta fase (pra deixar claro)

- ❌ Paywall global / bloqueio de acesso após trial
- ❌ Página `/carteira` e `/indique`
- ❌ Captura de `?ref=` no signup
- ❌ Cron de aplicação de desconto mensal no Asaas
- ❌ Webhook tratando indicação paga
- ❌ Remoção de `useUserUsage` / `FREE_LIMITS`

Tudo isso entra nas Fases 2 e 3. A Fase 1 é deliberadamente **invisível e não-destrutiva**: usuário continua usando o app exatamente como antes, mas começa a acumular coins silenciosamente. Se algo der errado, é trivial reverter (drop das tabelas + remover hook).

---

### 5. Entregáveis ao final da Fase 1

1. Bloco SQL único pra rodar no Studio self-hosted (com instruções).
2. Edge function `award-task-coins` no repo + comando de deploy pra VPS.
3. `useWallet` hook + integração no `TaskChecklist` + badge no header.
4. `src/integrations/supabase/types.ts` regenerado (via migration interna do Lovable).
5. Bloco copia-e-cola pra VPS no fim da resposta de implementação.

---

### Riscos / pontos de atenção

- **Idempotência das coins**: se usuário desmarcar e remarcar uma tarefa, NÃO ganha coin de novo (proteção via `unique(user_id, reference_id)` em `coin_transactions`).
- **Streak bônus**: só dispara quando o streak *fica* múltiplo de 7 (não toda vez que o usuário marca uma tarefa com streak já em 7).
- **Migração de premium atual**: usuários já pagantes precisam ter `subscription_state.status = 'active'` corretamente — vou pedir confirmação rodando um SELECT de validação no SQL antes do COMMIT mental.

Aprova pra eu começar?