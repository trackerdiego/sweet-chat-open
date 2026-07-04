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
  businessGoal: 'sell_products' | 'attract_clients' | 'personal_brand';
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
        // Só persiste runs ativos. Runs completos/falhos são lixo que faz o
        // onboarding pular direto pra tela final ao reabrir.
        if (r.status === 'pending' || r.status === 'running') {
          try { localStorage.setItem(STORAGE_KEY, r.id); } catch {}
        } else {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
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
      // Fetch direto pra capturar o body do erro (invoke engole o JSON em caso de non-2xx)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirou. Faça login novamente.');
      const url = `${(supabase as any).supabaseUrl}/functions/v1/start-onboarding-run`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: (supabase as any).supabaseKey,
        },
        body: JSON.stringify(params),
      });
      const raw = await res.text();
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch {}
      if (!res.ok) {
        const detail = parsed?.detail || parsed?.error || raw || `HTTP ${res.status}`;
        console.error('[start-onboarding-run] erro:', res.status, parsed || raw);
        throw new Error(`(${res.status}) ${detail}`);
      }
      const runId = parsed?.runId as string | undefined;
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
    // Só busca se temos um runId explícito armazenado. Sem isso, NÃO buscar o
    // último run do usuário — caso contrário um run antigo "completed" reaparece
    // e empurra direto pra tela final do onboarding.
    if (!storedId) return null;
    const res = await pollOnce(storedId);
    if (res?.run && (res.run.status === 'pending' || res.run.status === 'running')) {
      // Guard: só retoma runs RECENTES (< 10 min). Runs mais antigos provavelmente
      // são zumbis de uma sessão anterior — o input_payload pode estar desatualizado
      // (ex.: usuário recomeçou onboarding com nicho diferente). Limpa e ignora.
      const ageMs = Date.now() - new Date(res.run.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        console.warn('[useOnboardingRun] discarding stale run', res.run.id, `${Math.round(ageMs/60000)}min old`);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        setRun(null);
        setMatrixValidated(false);
        return null;
      }
      startPolling(res.run.id);
      return res.run;
    }
    // Run finalizado/falho ou inexistente: limpa estado local
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setRun(null);
    setMatrixValidated(false);
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
