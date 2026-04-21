import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DayStrategy, strategies as fallbackStrategies } from '@/data/strategies';

/**
 * Carrega estratégias do usuário com fallback automático para a matriz base.
 *
 * Comportamento:
 * 1. Se o usuário tem matriz personalizada salva → usa ela.
 * 2. Se não tem → usa fallbackStrategies imediatamente (sem loading travado).
 * 3. Se não tem, faz polling a cada 15s por até 5min para detectar quando a
 *    personalização (gerada em background pelo onboarding) ficar pronta.
 *    Quando chegar, troca automaticamente e mostra um toast.
 */
export function useUserStrategies() {
  const [strategies, setStrategies] = useState<DayStrategy[]>(fallbackStrategies);
  const [loading, setLoading] = useState(true);
  const [hasPersonalized, setHasPersonalized] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current as unknown as ReturnType<typeof setTimeout>);
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPersonalizing(false);
  }, []);

  const mergePersonalized = useCallback((parsed: DayStrategy[]): DayStrategy[] => {
    const full: DayStrategy[] = [];
    for (let i = 0; i < 30; i++) {
      const personalized = parsed.find(s => s.day === i + 1);
      full.push(personalized || fallbackStrategies[i]);
    }
    return full;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchStrategies = async (isPoll: boolean) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) {
          setStrategies(fallbackStrategies);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await (supabase.from as any)('user_strategies')
        .select('strategies')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.strategies) {
        const parsed = data.strategies as unknown as DayStrategy[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStrategies(mergePersonalized(parsed));
          setHasPersonalized(true);
          if (isPoll) {
            toast.success('✨ Sua matriz personalizada está pronta!');
          }
          stopPolling();
          setLoading(false);
          return;
        }
      }

      // Sem matriz personalizada — usa fallback e ativa polling se ainda não está rolando.
      setStrategies(fallbackStrategies);
      setLoading(false);

      if (!isPoll && !pollingRef.current) {
        // Polling agressivo (8s) nos primeiros 30s, depois 15s até 5min total.
        pollStartRef.current = Date.now();
        setIsPersonalizing(true);
        const tick = () => {
          const elapsed = Date.now() - pollStartRef.current;
          if (elapsed > 5 * 60 * 1000) {
            stopPolling();
            return;
          }
          fetchStrategies(true);
          const nextDelay = elapsed < 30_000 ? 8000 : 15000;
          pollingRef.current = setTimeout(tick, nextDelay) as unknown as ReturnType<typeof setInterval>;
        };
        pollingRef.current = setTimeout(tick, 8000) as unknown as ReturnType<typeof setInterval>;
      }
    };

    fetchStrategies(false);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [mergePersonalized, stopPolling]);

  return { strategies, loading, hasPersonalized, isPersonalizing };
}
