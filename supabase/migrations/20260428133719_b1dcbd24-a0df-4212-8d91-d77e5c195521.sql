-- =========================================
-- FASE 1: Premium + Gamificação (schema)
-- =========================================

-- 1. subscription_state
CREATE TABLE public.subscription_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','canceled')),
  plan TEXT CHECK (plan IN ('monthly','annual')),
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  asaas_subscription_id TEXT,
  asaas_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_state_user ON public.subscription_state(user_id);
CREATE INDEX idx_subscription_state_status ON public.subscription_state(status);

ALTER TABLE public.subscription_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscription" ON public.subscription_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages subscription" ON public.subscription_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. user_wallet
CREATE TABLE public.user_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  coins_balance INTEGER NOT NULL DEFAULT 0,
  referral_credits_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_coins_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_wallet_user ON public.user_wallet(user_id);

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own wallet" ON public.user_wallet
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages wallet" ON public.user_wallet
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. coin_transactions
CREATE TABLE public.coin_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task_complete','streak_bonus','redeem_discount','adjust','referral_bonus')),
  reference_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_id)
);
CREATE INDEX idx_coin_tx_user_created ON public.coin_transactions(user_id, created_at DESC);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own coin tx" ON public.coin_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages coin tx" ON public.coin_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. referral_codes
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
-- públicos pra leitura (necessário validar ?ref= no signup, antes do user logar)
CREATE POLICY "public read referral codes" ON public.referral_codes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service role manages referral codes" ON public.referral_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. referrals
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  referred_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  first_payment_at TIMESTAMPTZ,
  credit_awarded_brl NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own referrals as referrer" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "users read own referrals as referred" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referred_user_id);
CREATE POLICY "service role manages referrals" ON public.referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. monthly_redemptions
CREATE TABLE public.monthly_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_month TEXT NOT NULL, -- 'YYYY-MM'
  coins_used INTEGER NOT NULL DEFAULT 0,
  credits_used_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_brl_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asaas_subscription_id TEXT,
  UNIQUE (user_id, period_month)
);
CREATE INDEX idx_monthly_redemptions_user ON public.monthly_redemptions(user_id);

ALTER TABLE public.monthly_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own redemptions" ON public.monthly_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages redemptions" ON public.monthly_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =========================================
-- FUNÇÃO: award_task_coins (idempotente)
-- =========================================
CREATE OR REPLACE FUNCTION public.award_task_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reference_id TEXT,
  p_type TEXT DEFAULT 'task_complete',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(awarded INTEGER, new_balance INTEGER) AS $$
DECLARE
  v_inserted_id UUID;
  v_new_balance INTEGER;
BEGIN
  -- Garante wallet existe
  INSERT INTO public.user_wallet (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Tenta inserir transação; se já existe (mesmo reference_id), retorna 0
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, metadata)
  VALUES (p_user_id, p_amount, p_type, p_reference_id, p_metadata)
  ON CONFLICT (user_id, reference_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT coins_balance INTO v_new_balance FROM public.user_wallet WHERE user_id = p_user_id;
    RETURN QUERY SELECT 0, COALESCE(v_new_balance, 0);
    RETURN;
  END IF;

  -- Atualiza saldo
  UPDATE public.user_wallet
  SET coins_balance = coins_balance + p_amount,
      lifetime_coins_earned = lifetime_coins_earned + GREATEST(p_amount, 0),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING coins_balance INTO v_new_balance;

  RETURN QUERY SELECT p_amount, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.award_task_coins FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_task_coins TO service_role;

-- =========================================
-- MIGRAÇÃO INICIAL DE DADOS
-- =========================================
-- Wallet zerada pra todos
INSERT INTO public.user_wallet (user_id)
SELECT user_id FROM public.user_usage
ON CONFLICT (user_id) DO NOTHING;

-- subscription_state baseado em is_premium
INSERT INTO public.subscription_state (user_id, status, trial_ends_at, plan)
SELECT
  user_id,
  CASE WHEN is_premium THEN 'active' ELSE 'trial' END,
  CASE WHEN is_premium THEN NULL ELSE now() + interval '7 days' END,
  CASE WHEN is_premium THEN 'monthly' ELSE NULL END
FROM public.user_usage
ON CONFLICT (user_id) DO NOTHING;

-- referral_codes únicos pra todos (substring do uuid + sufixo aleatório curto)
INSERT INTO public.referral_codes (user_id, code)
SELECT
  user_id,
  lower(substring(replace(user_id::text, '-', ''), 1, 6) || substring(replace(gen_random_uuid()::text, '-', ''), 1, 2))
FROM public.user_usage
ON CONFLICT (user_id) DO NOTHING;