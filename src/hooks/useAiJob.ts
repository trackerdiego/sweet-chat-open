// useAiJob — hook genérico para o padrão de jobs assíncronos de IA.
// Padrão: chama start-{type}-job → recebe jobId → faz polling em get-ai-job-status
// até status === 'done' ou 'failed'. Imune a timeouts de gateway.
//
// Uso típico:
//   const { start, status, result, error, reset } = useAiJob('script');
//   await start({ day, title, ... });
//   if (status === 'done') console.log(result);

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createEdgeFunctionError, getResponseErrorMessage } from '@/lib/edgeFunctionErrors';

export type AiJobType = 'tools' | 'script' | 'daily_guide' | 'transcription';
export type AiJobStatus = 'idle' | 'starting' | 'processing' | 'done' | 'failed';

const FUNCTION_BY_TYPE: Record<AiJobType, string> = {
  tools: 'start-tools-job',
  script: 'start-script-job',
  daily_guide: 'start-daily-guide-job',
  transcription: 'start-transcription-job',
};

const POLL_INTERVAL_MS = 2000;
// Hard cap de segurança: 5 min. Se passar disso o worker provavelmente travou.
const MAX_POLL_MS = 5 * 60 * 1000;

interface JobRecord {
  id: string;
  job_type: AiJobType;
  status: 'pending' | 'processing' | 'done' | 'failed';
  result: unknown;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export function useAiJob<TResult = unknown>(jobType: AiJobType) {
  const [status, setStatus] = useState<AiJobStatus>('idle');
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setResult(null);
    setError(null);
    setJobId(null);
  }, [stopPolling]);

  const pollOnce = useCallback(async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      // Edge function aceita query params, então monto URL manual
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseUrl = (supabase as any).supabaseUrl as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apikey = (supabase as any).supabaseKey as string;
      const url = new URL(`${baseUrl}/functions/v1/get-ai-job-status`);
      url.searchParams.set('jobId', id);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey },
      });
      if (!res.ok) throw new Error(await getResponseErrorMessage(res));
      const json = await res.json();
      return (json?.job ?? null) as JobRecord | null;
    } catch (e) {
      console.warn('[useAiJob] poll failed', e);
      throw e;
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    startedAtRef.current = Date.now();
    pollTimer.current = setInterval(async () => {
      // Hard cap
      if (Date.now() - startedAtRef.current > MAX_POLL_MS) {
        stopPolling();
        setStatus('failed');
        setError('A geração demorou mais que o esperado. Tente novamente.');
        return;
      }
      let job: JobRecord | null = null;
      try {
        job = await pollOnce(id);
      } catch (e) {
        stopPolling();
        setStatus('failed');
        setError(e instanceof Error ? e.message : 'Erro ao consultar status da geração.');
        return;
      }
      if (!job) return;
      if (job.status === 'processing' || job.status === 'pending') {
        setStatus('processing');
        return;
      }
      if (job.status === 'done') {
        stopPolling();
        setResult(job.result as TResult);
        setStatus('done');
        return;
      }
      if (job.status === 'failed') {
        stopPolling();
        setError(job.error_message || 'Erro ao processar. Tente novamente.');
        setStatus('failed');
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

  const start = useCallback(async (payload: Record<string, unknown>) => {
    reset();
    setStatus('starting');
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(FUNCTION_BY_TYPE[jobType], { body: payload });
      if (invokeErr) {
        throw await createEdgeFunctionError(invokeErr, 'Falha ao iniciar geração');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (data as any)?.jobId as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = (data as any)?.error as string | undefined;
      if (apiErr) throw new Error(apiErr);
      if (!id) throw new Error('Resposta inválida (jobId ausente)');
      setJobId(id);
      setStatus('processing');
      startPolling(id);
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao iniciar geração';
      setError(msg);
      setStatus('failed');
      throw e;
    }
  }, [jobType, reset, startPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { start, reset, status, result, error, jobId,
    isLoading: status === 'starting' || status === 'processing',
  };
}
