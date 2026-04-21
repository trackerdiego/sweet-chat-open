import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DayStrategy, strategies as fallbackStrategies } from '@/data/strategies';

/**
 * Carrega estratégias do usuário.
 *
 * Comportamento:
 * 1. Se o usuário tem matriz personalizada VÁLIDA salva (>= 28 itens) → usa ela.
 * 2. Caso contrário → usa fallbackStrategies como segurança visual.
 *
 * Não há mais polling/background — a geração só acontece no pipeline visível
 * do onboarding. A trava de integridade em useUserProfile garante que nenhum
 * usuário sem matriz válida chega aqui marcado como onboarding completo.
 */
export function useUserStrategies() {
  const [strategies, setStrategies] = useState<DayStrategy[]>(fallbackStrategies);
  const [loading, setLoading] = useState(true);
  const [hasPersonalized, setHasPersonalized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStrategies = async () => {
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
        if (Array.isArray(parsed) && parsed.length >= 28) {
          // Mescla com fallback caso falte algum dia (garantir 30 posições).
          const full: DayStrategy[] = [];
          for (let i = 0; i < 30; i++) {
            const personalized = parsed.find(s => s.day === i + 1);
            full.push(personalized || fallbackStrategies[i]);
          }
          setStrategies(full);
          setHasPersonalized(true);
          setLoading(false);
          return;
        }
      }

      setStrategies(fallbackStrategies);
      setLoading(false);
    };

    fetchStrategies();

    return () => {
      cancelled = true;
    };
  }, []);

  return { strategies, loading, hasPersonalized, isPersonalizing: false };
}
