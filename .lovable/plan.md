
## Fase 3 — Paywall após Trial + Desconto Automático no Asaas

Objetivo: ativar o modelo **100% pago** com trial de 7 dias e fazer os coins/créditos virarem **desconto real na próxima fatura** automaticamente, via cron + PATCH na subscription do Asaas.

---

### 1. `useSubscription` — fonte da verdade nova

Hook novo `src/hooks/useSubscription.ts` que lê `subscription_state`:

- Retorna `{ status, trialEndsAt, currentPeriodEnd, plan, daysLeftInTrial, isActive, isTrialing, isExpired, hasAccess, loading }`.
- `hasAccess = status === 'active' || (status === 'trial' && trialEndsAt > now)`.
- `daysLeftInTrial = ceil((trialEndsAt - now) / day)`.
- `useUserUsage` continua existindo pra compatibilidade dos contadores diários (script/tool/chat/transcription), mas **`isPremium` lá vira derivado de `hasAccess`** (conceitualmente — pra não quebrar componentes existentes, vou injetar via override mínimo: `useUserUsage` lê `subscription_state` e popula `is_premium` no return baseado em `hasAccess`).

---

### 2. Paywall global

**Componente novo** `src/components/AccessGuard.tsx`:
- Wrapper que usa `useSubscription`. Se `!hasAccess && !loading`, renderiza tela de bloqueio cheia (não dá pra fechar).
- Tela de bloqueio: mensagem "Seu acesso expirou" / "Seu trial acabou", CTA grande "Assinar agora" (abre `CheckoutModal`), botão secundário "Ver minha indicação" (vai pra `/indique` — incentivo a chamar amigos pra ganhar crédito).
- Variante quando `isTrialing`: **NÃO bloqueia**, mas mostra banner persistente no topo do app: "🎁 X dias grátis restantes — Assine agora pra continuar".
- Aplicado em `App.tsx` envolvendo todas as rotas autenticadas (exceto `/onboarding`, `/carteira`, `/indique` — essas devem ser acessíveis pra não prender o usuário antes da decisão).

**Remover gates do tipo "free_days":**
- `useUserUsage.canAccessDay` agora retorna sempre `true` se `hasAccess` (não tem mais limite de 7 dias dentro do app — quem tá no trial vê tudo, quem expirou vê o paywall).
- Remover blur de `Matrix.tsx`/`Tasks.tsx` baseado em `canAccessDay` — eles continuam chamando o método mas ele vira no-op pra usuários com `hasAccess`.
- Manter os contadores diários (script/tool/chat) **só durante trial** — quem tem `status='active'` tem ilimitado, quem tá no trial respeita os mesmos `FREE_LIMITS` atuais.

---

### 3. Resgate de coins/créditos — UI

#### `/carteira` ganha botão "Aplicar na próxima fatura"
- Visível só se `subscription_state.status === 'active'` E o usuário tem coins > 0 ou referral_credits > 0.
- Modal de confirmação:
  - Mostra: saldo atual em coins (R$ X,XX), créditos R$ Y,YY → desconto total Z na próxima fatura (R$47 - desconto).
  - Limita: desconto não pode passar do valor da fatura (e.g. se mensalidade = R$47 e usuário tem R$100 em créditos, só usa R$47, sobra R$53).
  - Avisa: "Pode ser aplicado 1x por mês. A aplicação acontece automaticamente no dia da renovação."
- Na verdade: a aplicação **já é automática via cron**. O botão é só pra **opt-out / antecipar visualização** — vou simplificar: **não tem botão**, é tudo automático. A UI da Carteira só **mostra**: "Próximo desconto previsto: R$ X,XX em DD/MM" baseado em `current_period_end` e saldo atual.

Decisão pra simplicidade: **sem botão, tudo automático.** UI da Carteira mostra preview do desconto da próxima fatura.

---

### 4. Cron de aplicação de desconto

#### Edge function nova: `apply-monthly-discounts`
- Disparada por cron da VPS (crontab → curl) **diariamente às 03:00 BRT**.
- Lógica:
  1. SELECT `subscription_state` onde `status='active'` AND `current_period_end::date = (CURRENT_DATE + INTERVAL '2 days')` (aplica 2 dias antes da renovação — janela segura pro Asaas processar).
  2. Pra cada user: lê `user_wallet` (coins_balance + referral_credits_brl).
  3. Calcula desconto total: `coins * 0.01 + referral_credits_brl`, capped no valor da fatura (R$47 mensal ou R$397 anual — busca no Asaas pelo `asaas_subscription_id`).
  4. Se desconto > 0:
     - Verifica idempotência: SELECT `monthly_redemptions` por `(user_id, period_month=YYYY-MM da current_period_end)`. Se já tem, pula.
     - PATCH na subscription Asaas: `value = price - discount` (próxima fatura só). Asaas API: `PATCH /subscriptions/{id}` com `value` novo + `updatePendingPayments=true`.
     - Insere `monthly_redemptions` (lock idempotente).
     - Debita `user_wallet`: `coins_balance -= coinsUsed`, `referral_credits_brl -= creditsUsed`. **Não debita `lifetime_coins_earned`** (esse é cumulativo).
     - Loga em `coin_transactions` (type=`redeem_discount`, amount=`-coinsUsed`, reference_id=`redeem-{period_month}`, metadata={discount_brl, period_month}).
  5. **Reverter o valor da subscription depois**: cria edge function complementar `revert-subscription-value` agendada pra rodar **5 dias depois**, OU mais simples: usa `PATCH` com `value` original quando o webhook `PAYMENT_RECEIVED` confirmar.

**Decisão sobre reverter:** o jeito mais limpo é o webhook `PAYMENT_RECEIVED` chamar PATCH de volta pro valor cheio. Vou adicionar isso no `asaas-webhook` quando ele detectar que aquela `monthly_redemption` foi consumida.

#### Padrão self-hosted (curl + crontab)
Não usa pg_cron. Vai no crontab da VPS:
```cron
0 6 * * * curl -X POST https://api.influlab.pro/functions/v1/apply-monthly-discounts -H "Authorization: Bearer $CRON_TOKEN" >> /var/log/apply-discounts.log 2>&1
```
A function valida `Authorization: Bearer ${CRON_SECRET}` no header (novo secret).

---

### 5. Migração de dados (SQL pro Studio)

**Trial de 7 dias pra todos free atuais (já feito na Fase 1).** Verificar se `subscription_state` tem todos. Se não tiver (signup novo entre Fase 1 e 3), o `handle_new_user` precisa criar.

#### Trigger pra criar `subscription_state` no signup
```sql
-- Atualiza handle_new_user pra também criar subscription_state em trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (...) ...; -- já existe
  INSERT INTO public.subscription_state (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trial', now() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_wallet (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  -- gera referral_code se ainda não tem
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, upper(substring(replace(NEW.id::text,'-',''), 1, 8)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
```

#### Backfill pra usuários sem subscription_state
```sql
INSERT INTO public.subscription_state (user_id, status, trial_ends_at)
SELECT u.user_id,
  CASE WHEN COALESCE(uu.is_premium, false) THEN 'active' ELSE 'trial' END,
  CASE WHEN COALESCE(uu.is_premium, false) THEN NULL ELSE now() + INTERVAL '7 days' END
FROM public.user_profiles u
LEFT JOIN public.user_usage uu ON uu.user_id = u.user_id
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_state s WHERE s.user_id = u.user_id);
```

---

### 6. CheckoutModal — leve atualização

- Após redirect pro Asaas (após assinar), assume otimisticamente que vira `active` quando webhook chegar.
- Adiciona menção sutil: "Você ainda tem X dias grátis — sua assinatura começa após o trial" se `isTrialing`. (Cosmético — Asaas sempre cobra de cara, mas a mensagem reforça que o usuário não tá perdendo nada.)
- Sem mudança estrutural.

---

### 7. Secrets novos

- `CRON_SECRET` — token bearer pro endpoint `apply-monthly-discounts` validar que é o crontab.

---

### 8. Entregáveis

1. `src/hooks/useSubscription.ts` novo
2. `src/hooks/useUserUsage.ts` adaptado pra ler `is_premium` de `subscription_state.hasAccess` (compat)
3. `src/components/AccessGuard.tsx` + integração no `App.tsx`
4. `src/components/TrialBanner.tsx` (banner persistente durante trial)
5. `src/pages/Wallet.tsx` mostra "Próximo desconto previsto"
6. Edge function `apply-monthly-discounts`
7. `asaas-webhook` reverte `value` da subscription após `PAYMENT_RECEIVED` quando `monthly_redemption` foi aplicada
8. SQL pro Studio: trigger atualizado + backfill de subscription_state
9. Crontab snippet pro user adicionar na VPS
10. Bloco copia-e-cola pra VPS no final

---

### 9. O que NÃO entra nesta fase

- ❌ Remoção total de `useUserUsage` (mantido pra contadores diários)
- ❌ Notificações push de "trial vai expirar em X dias"
- ❌ Página admin pra forçar/estender trial (próxima fase opcional)
- ❌ Cupom/promo manual

---

### 10. Riscos / pontos de atenção

- **PATCH no Asaas com `value` reduzido afeta SÓ a próxima fatura?** Sim, se passar `updatePendingPayments=true` ele atualiza só a fatura pendente; depois precisa reverter. **Crítico**: se não revertermos, o usuário fica pagando o valor descontado pra sempre. Vamos reverter no `PAYMENT_RECEIVED`.
- **Idempotência total**: `monthly_redemptions(user_id, period_month)` precisa ser UNIQUE. Vou adicionar via SQL.
- **Race condition do cron**: se o cron rodar 2x no mesmo dia, o `unique(user_id, period_month)` bloqueia. ✅
- **Trial expirado mas usuário não assinou**: vê o paywall mas pode entrar em /carteira e /indique. Isso permite ele indicar amigos pra ganhar créditos e voltar (não tira do funil).
- **Premium atual**: continua `active`, recebe descontos automáticos imediatamente se tiver coins acumulados.
- **Conversão coin → BRL**: 1 coin = R$ 0,01 (10 tarefas/dia × 30 dias = 3000 coins = R$30 desconto numa mensalidade de R$47, ou seja, ~64% de desconto se completar tudo. Vou marcar isso como ponto pra ajuste posterior se ficar generoso demais).

Aprova pra eu começar a implementar?
