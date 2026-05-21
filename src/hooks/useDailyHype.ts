// useDailyHype — lê user_daily_hype de hoje; se não existir, dispara start-hype-job
// via useAiJob('hype') e popula o cache. Reuso de localStorage evita disparar
// 2x na mesma sessão se houver remount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAiJob } from './useAiJob';

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
  const { start, status, result, error: jobError } = useAiJob<{ items: HypeItem[] }>('hype');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const today = todayISO();
      const { data } = await (supabase.from as any)('user_daily_hype')
        .select('items')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items as HypeItem[]);
        setLoading(false);
        return;
      }

      // sem cache: dispara job (uma vez por sessão)
      if (startedRef.current) { setLoading(false); return; }
      startedRef.current = true;
      await start({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar hype do dia');
      setLoading(false);
    }
  }, [start]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (status === 'done' && result?.items) {
      setItems(result.items);
      setLoading(false);
    } else if (status === 'failed') {
      setError(jobError || 'Não foi possível gerar o hype do dia.');
      setLoading(false);
    } else if (status === 'starting' || status === 'processing') {
      setLoading(true);
    }
  }, [status, result, jobError]);

  return { items, loading: loading || status === 'starting' || status === 'processing', error, reload: load };
}
