-- Tabela única para jobs assíncronos de IA (tools, script, daily-guide, transcription)
-- Padrão: frontend chama start-* (responde <2s com jobId), worker processa em background via EdgeRuntime.waitUntil,
-- frontend faz polling em get-ai-job-status. Imune a timeouts de Kong/Cloudflare/Nginx.

CREATE TABLE public.ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('tools', 'script', 'daily_guide', 'transcription')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

-- Usuários só leem seus próprios jobs
CREATE POLICY "users read own ai_jobs"
ON public.ai_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Service role faz tudo (workers escrevem com service role)
CREATE POLICY "service role manages ai_jobs"
ON public.ai_jobs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Index pra polling rápido por usuário + status
CREATE INDEX ai_jobs_user_status_idx ON public.ai_jobs (user_id, status, created_at DESC);
CREATE INDEX ai_jobs_created_at_idx ON public.ai_jobs (created_at DESC);