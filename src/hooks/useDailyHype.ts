// useDailyHype — lê user_daily_hype de hoje; se não existir, dispara start-hype-job
// via useAiJob('hype') e popula o cache. Reuso de localStorage evita disparar
// 2x na mesma sessão se houver remount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAiJob } from './useAiJob';
import { HYPE_GLOBAL_RELEASE } from '@/lib/featureFlags';

export interface HypeItem {
  tema: string;
  porque_bombou: string;
  gancho: string;
  formato_sugerido: string;
  angulo: string;
  fonte: string;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function useDailyHype() {
  const [items, setItems] = useState<HypeItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const statusRef = useRef('idle');
  const { start, status, result, error: jobError } = useAiJob<{ items: HypeItem[] }>('hype');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    // Kill-switch global: se a feature não foi liberada, NUNCA dispara start-hype-job.
    // Evita queimar tokens Gemini caso o componente seja renderizado por engano.
    if (!HYPE_GLOBAL_RELEASE) {
      setItems(null);
      setError('Em breve');
      setLoading(false);
      return;
    }
    try {

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      if (statusRef.current === 'starting' || statusRef.current === 'processing') {
        return;
      }

      const today = todayISO();
      const { data } = await (supabase.from as any)('user_daily_hype')
        .select('items')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (!force && data?.items && Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items as HypeItem[]);
        setLoading(false);
        return;
      }

      // sem cache: dispara job (uma vez por sessão)
      if (!force && startedRef.current) { setLoading(false); return; }
      startedRef.current = true;
      await start({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar hype do dia');
      setLoading(false);
    }
  }, [start]);

  const lastReloadRef = useRef(0);
  const reload = useCallback(() => {
    if (statusRef.current === 'starting' || statusRef.current === 'processing') return;
    const now = Date.now();
    if (now - lastReloadRef.current < 30000) return; // anti-spam: 30s
    lastReloadRef.current = now;
    startedRef.current = false;
    setItems(null);
    void load(true);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (status === 'done' && result?.items && result.items.length > 0) {
      setItems(result.items);
      setLoading(false);
    } else if (status === 'done') {
      setItems(null);
      setError('A geração terminou sem sugestões. Tente novamente em instantes.');
      setLoading(false);
    } else if (status === 'failed') {
      setError(jobError || 'Não foi possível gerar o hype do dia.');
      setLoading(false);
    } else if (status === 'starting' || status === 'processing') {
      setLoading(true);
    }
  }, [status, result, jobError]);

  return { items, loading: loading || status === 'starting' || status === 'processing', error, reload };
}
