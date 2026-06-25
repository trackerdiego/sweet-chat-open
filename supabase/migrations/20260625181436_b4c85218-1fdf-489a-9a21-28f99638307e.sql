ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone) WHERE phone IS NOT NULL;