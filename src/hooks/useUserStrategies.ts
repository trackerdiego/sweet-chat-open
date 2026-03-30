import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DayStrategy, strategies as fallbackStrategies } from '@/data/strategies';

export function useUserStrategies() {
  const [strategies, setStrategies] = useState<DayStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPersonalized, setHasPersonalized] = useState(false);

  useEffect(() => {
    const fetchStrategies = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setStrategies(fallbackStrategies);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase.from as any)('user_strategies')
        .select('strategies')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!error && data?.strategies) {
        const parsed = data.strategies as unknown as DayStrategy[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const full: DayStrategy[] = [];
          for (let i = 0; i < 30; i++) {
            const personalized = parsed.find(s => s.day === i + 1);
            full.push(personalized || fallbackStrategies[i]);
          }
          setStrategies(full);
          setHasPersonalized(true);
        }
      }

      setLoading(false);
    };

    fetchStrategies();
  }, []);

  return { strategies, loading, hasPersonalized };
}
