
ALTER TABLE public.user_profiles
ADD COLUMN description_status text NOT NULL DEFAULT 'pending';

-- Backfill: mark users with real descriptions as 'ok'
UPDATE public.user_profiles
SET description_status = 'ok'
WHERE primary_niche IS NOT NULL
  AND primary_niche != 'lifestyle'
  AND primary_niche != '';

-- Update handle_new_user to set description_status = 'pending' for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, primary_niche, onboarding_completed, description_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Creator'), 'lifestyle', false, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
