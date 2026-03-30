import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InfluencerProgress {
  current_day: number;
  start_date: string;
  tasks_completed: Record<string, any>;
  streak: number;
  influence_points: number;
}

const defaultProgress: InfluencerProgress = {
  current_day: 1,
  start_date: new Date().toISOString().split('T')[0],
  tasks_completed: {},
  streak: 0,
  influence_points: 0,
};

function calcRealDay(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(30, diffDays + 1));
}

export function useUserProgress() {
  const [progress, setProgress] = useState<InfluencerProgress>(defaultProgress);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUserId(session.user.id);

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!error && data) {
        const realDay = calcRealDay(data.start_date);
        const needsSync = realDay > data.current_day;

        const synced = {
          current_day: realDay,
          start_date: data.start_date,
          tasks_completed: (data.tasks_completed as Record<string, any>) || {},
          streak: data.streak,
          influence_points: data.influence_points,
        };

        setProgress(synced);

        if (needsSync) {
          await supabase
            .from('user_progress')
            .update({ current_day: realDay, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id);
        }
      } else if (!data) {
        const initial = {
          user_id: session.user.id,
          current_day: 1,
          start_date: new Date().toISOString().split('T')[0],
          tasks_completed: {},
          streak: 0,
          influence_points: 0,
        };
        await supabase.from('user_progress').insert(initial);
      }
      setLoading(false);
    };
    load();
  }, []);

  const persist = useCallback((updated: InfluencerProgress) => {
    if (!userId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await supabase
        .from('user_progress')
        .update({
          current_day: updated.current_day,
          start_date: updated.start_date,
          tasks_completed: updated.tasks_completed,
          streak: updated.streak,
          influence_points: updated.influence_points,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }, 500);
  }, [userId]);

  const updateProgress = useCallback((updater: (prev: InfluencerProgress) => InfluencerProgress) => {
    setProgress(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const resetProgress = useCallback(() => {
    const reset = { ...defaultProgress, start_date: new Date().toISOString().split('T')[0] };
    setProgress(reset);
    persist(reset);
  }, [persist]);

  return { progress, loading, updateProgress, resetProgress };
}
