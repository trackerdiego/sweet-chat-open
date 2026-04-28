ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS attempts INT;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS model_used TEXT;