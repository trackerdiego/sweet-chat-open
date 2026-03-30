ALTER TABLE public.audience_profiles
  ADD CONSTRAINT audience_profiles_user_id_key UNIQUE (user_id);

ALTER TABLE public.user_strategies
  ADD CONSTRAINT user_strategies_user_id_key UNIQUE (user_id);