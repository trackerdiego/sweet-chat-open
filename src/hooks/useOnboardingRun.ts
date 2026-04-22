import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StageKey = 'profile' | 'audience' | 'visceral' | 'matrix';
export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export interface StageRecord {
  key: StageKey;
  label: string;
  status: StageStatus;
  started_at?: string;
  finished_at?: string;
  error?: string;
  source?: 'ai' | 'fallback' | 'mixed';
}

export interface OnboardingRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_stage: number;
  stages: StageRecord[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface StartParams {
  displayName: string;
  primaryNiche: string;
  secondaryNiches?: string[];
  contentStyle: string;
}

const POLL_INTERVAL_MS = 2000;
const STORAGE_KEY = 'influlab.onboardingRunId';

export function useOnboardingRun() {
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [matrixValidated, setMatrixValidated] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async (runId?: string) => {
    try {
      const params = runId ? { runId } : undefined;
      const { data, error: invokeErr } = await supabase.functions.invoke('get-onboarding-run-status', {
        body: undefined,
        method: 'GET',
        // @ts-expect-error supabase-js permite query params via headers no v2; usamos fetch direto abaixo se preciso
      } as any);
      // O invoke não passa query bem; faço fetch manual.
      void invokeErr;
      void data;
      void params;
      return null;
    } catch {
      return null;
    }
  }, []);

  // Faz fetch direto à edge para conseguir passar query params
  const pollOnce = useCallback(async (runId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const url = new URL(`${(supabase as any).supabaseUrl}/functions/v1/get-onboarding-run-status`);
      if (runId) url.searchParams.set('runId', runId);
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: (supabase as any).supabaseKey,
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const r = (json?.run ?? null) as OnboardingRun | null;
      const mv = !!json?.matrixValidated;
      if (r) {
        setRun(r);
        setMatrixValidated(mv);
        runIdRef.current = r.id;
        try { localStorage.setItem(STORAGE_KEY, r.id); } catch {}
      }
      return { run: r, matrixValidated: mv };
    } catch (e) {
      console.warn('[useOnboardingRun] poll failed', e);
      return null;
    }
  }, []);

  const startPolling = useCallback((runId: string) => {
    stopPolling();
    runIdRef.current = runId;
    pollOnce(runId);
    pollTimer.current = setInterval(() => {
      const id = runIdRef.current;
      if (!id) return;
      pollOnce(id).then((res) => {
        if (!res) return;
        const r = res.run;
        if (!r) return;
        if (r.status === 'completed' || r.status === 'failed') {
          stopPolling();
        }
      });
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

  const start = useCallback(async (params: StartParams) => {
    setStarting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('start-onboarding-run', {
        body: params,
      });
      if (invokeErr) throw invokeErr;
      const runId = (data as any)?.runId as string | undefined;
      if (!runId) throw new Error('runId ausente na resposta');
      try { localStorage.setItem(STORAGE_KEY, runId); } catch {}
      startPolling(runId);
      return runId;
    } catch (e: any) {
      const msg = e?.message || 'Falha ao iniciar onboarding';
      setError(msg);
      throw e;
    } finally {
      setStarting(false);
    }
  }, [startPolling]);

  // Tenta retomar run em andamento ao montar
  const resume = useCallback(async () => {
    let storedId: string | null = null;
    try { storedId = localStorage.getItem(STORAGE_KEY); } catch {}
    const res = await pollOnce(storedId || undefined);
    if (res?.run && (res.run.status === 'pending' || res.run.status === 'running')) {
      startPolling(res.run.id);
      return res.run;
    }
    if (res?.run && res.run.status === 'completed' && res.matrixValidated) {
      return res.run;
    }
    return null;
  }, [pollOnce, startPolling]);

  const clear = useCallback(() => {
    stopPolling();
    setRun(null);
    setMatrixValidated(false);
    runIdRef.current = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { run, matrixValidated, starting, error, start, resume, clear };
}
