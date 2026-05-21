-- Hype do Dia: feed de tendências do dia personalizado por nicho.
-- daily_hype_raw guarda o scraping global diário (1x por dia, compartilhado).
-- user_daily_hype guarda o resultado curado/adaptado por usuário (cache 24h).

CREATE TABLE IF NOT EXISTS public.daily_hype_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  source text NOT NULL,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, source)
);

ALTER TABLE public.daily_hype_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages daily_hype_raw"
  ON public.daily_hype_raw FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read daily_hype_raw"
  ON public.daily_hype_raw FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_daily_hype_raw_date ON public.daily_hype_raw(date DESC);

CREATE TABLE IF NOT EXISTS public.user_daily_hype (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.user_daily_hype ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages user_daily_hype"
  ON public.user_daily_hype FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "users read own daily hype"
  ON public.user_daily_hype FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_daily_hype_user_date ON public.user_daily_hype(user_id, date DESC);