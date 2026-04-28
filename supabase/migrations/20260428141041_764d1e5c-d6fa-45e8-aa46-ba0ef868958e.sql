-- 1) Unique em monthly_redemptions pra idempotência do cron
DO $$ BEGIN
  ALTER TABLE public.monthly_redemptions
    ADD CONSTRAINT monthly_redemptions_user_period_unique UNIQUE (user_id, period_month);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- 2) Trigger handle_new_user: cria perfil + subscription_state + wallet + referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, primary_niche, onboarding_completed, description_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Creator'), 'lifestyle', false, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.subscription_state (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trial', now() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_wallet (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, upper(substring(replace(NEW.id::text, '-', ''), 1, 8)))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Garante o trigger no auth.users (cria se não existir)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Backfill subscription_state pra todos sem registro
INSERT INTO public.subscription_state (user_id, status, trial_ends_at)
SELECT u.user_id,
  CASE WHEN COALESCE(uu.is_premium, false) THEN 'active' ELSE 'trial' END,
  CASE WHEN COALESCE(uu.is_premium, false) THEN NULL ELSE now() + INTERVAL '7 days' END
FROM public.user_profiles u
LEFT JOIN public.user_usage uu ON uu.user_id = u.user_id
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_state s WHERE s.user_id = u.user_id);

-- 5) Backfill wallet e referral_code pros sem registro
INSERT INTO public.user_wallet (user_id)
SELECT u.user_id FROM public.user_profiles u
WHERE NOT EXISTS (SELECT 1 FROM public.user_wallet w WHERE w.user_id = u.user_id);

INSERT INTO public.referral_codes (user_id, code)
SELECT u.user_id, upper(substring(replace(u.user_id::text, '-', ''), 1, 8))
FROM public.user_profiles u
WHERE NOT EXISTS (SELECT 1 FROM public.referral_codes c WHERE c.user_id = u.user_id);