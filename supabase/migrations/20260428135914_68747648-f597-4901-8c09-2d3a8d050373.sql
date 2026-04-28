DO $$ BEGIN
  ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_user_unique UNIQUE (referred_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_tx_user_ref_unique UNIQUE (user_id, reference_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;