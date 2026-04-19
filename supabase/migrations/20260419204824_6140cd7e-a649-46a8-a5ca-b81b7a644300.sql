UPDATE public.user_usage
SET is_premium = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'agentevendeagente@gmail.com');

INSERT INTO public.user_usage (user_id, is_premium)
SELECT id, true FROM auth.users
WHERE email = 'agentevendeagente@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_usage u WHERE u.user_id = auth.users.id
  );