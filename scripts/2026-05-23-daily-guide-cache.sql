-- Cache do Guia do Dia por usuário/dia/data civil.
-- Permite auto-personalização ao abrir /tarefas sem regerar a IA a cada visita.
-- Rodar 1x no Studio self-hosted: https://api.influlab.pro

CREATE TABLE IF NOT EXISTS public.daily_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day integer NOT NULL,
  date date NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  task_examples jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, date)
);

CREATE INDEX IF NOT EXISTS daily_guide_cache_user_date_idx
  ON public.daily_guide_cache (user_id, date DESC);

ALTER TABLE public.daily_guide_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own cache" ON public.daily_guide_cache;
CREATE POLICY "users read own cache" ON public.daily_guide_cache
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service role manages cache" ON public.daily_guide_cache;
CREATE POLICY "service role manages cache" ON public.daily_guide_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
