import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserUsage {
  script_generations: number;
  tool_generations: number;
  transcriptions: number;
  chat_messages: number;
  is_premium: boolean;
  last_script_date: string | null;
}

const FREE_LIMITS = {
  script_generations: 3,
  tool_generations: 2,
  transcriptions: 2,
  chat_messages: 10,
  free_days: 7,
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useUserUsage() {
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrCreate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await (supabase.from as any)('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) { console.error('useUserUsage fetch error:', error); setLoading(false); return; }

      if (data) {
        setUsage(data as UserUsage);
      } else {
        const { data: inserted, error: insertErr } = await (supabase.from as any)('user_usage')
          .insert({ user_id: user.id })
          .select()
          .single();
        if (!insertErr && inserted) setUsage(inserted as UserUsage);
      }
      setLoading(false);
    };

    fetchOrCreate();
  }, []);

  const isPremium = usage?.is_premium ?? false;

  const today = getTodayDate();
  const scriptCountToday = (usage?.last_script_date === today) ? (usage?.script_generations ?? 0) : 0;

  const canUseScript = isPremium || scriptCountToday < FREE_LIMITS.script_generations;
  const canUseTool = isPremium || (usage?.tool_generations ?? 0) < FREE_LIMITS.tool_generations;
  const canTranscribe = isPremium || (usage?.transcriptions ?? 0) < FREE_LIMITS.transcriptions;
  const canUseChat = isPremium || (usage?.chat_messages ?? 0) < FREE_LIMITS.chat_messages;

  const canAccessDay = useCallback((day: number) => {
    return isPremium || day <= FREE_LIMITS.free_days;
  }, [isPremium]);

  const remainingScripts = isPremium ? Infinity : Math.max(0, FREE_LIMITS.script_generations - scriptCountToday);
  const remainingTools = isPremium ? Infinity : Math.max(0, FREE_LIMITS.tool_generations - (usage?.tool_generations ?? 0));
  const remainingTranscriptions = isPremium ? Infinity : Math.max(0, FREE_LIMITS.transcriptions - (usage?.transcriptions ?? 0));
  const remainingChat = isPremium ? Infinity : Math.max(0, FREE_LIMITS.chat_messages - (usage?.chat_messages ?? 0));

  const incrementUsage = useCallback(async (feature: 'script_generations' | 'tool_generations' | 'transcriptions' | 'chat_messages') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (feature === 'script_generations') {
      const isNewDay = usage?.last_script_date !== today;
      const newCount = isNewDay ? 1 : (usage?.script_generations ?? 0) + 1;

      const { error } = await (supabase.from as any)('user_usage')
        .update({ script_generations: newCount, last_script_date: today })
        .eq('user_id', user.id);

      if (!error) {
        setUsage(prev => prev ? { ...prev, script_generations: newCount, last_script_date: today } : prev);
      }
    } else {
      const currentVal = usage?.[feature] ?? 0;
      const { error } = await (supabase.from as any)('user_usage')
        .update({ [feature]: currentVal + 1 })
        .eq('user_id', user.id);

      if (!error) {
        setUsage(prev => prev ? { ...prev, [feature]: currentVal + 1 } : prev);
      }
    }
  }, [usage, today]);

  return {
    usage,
    loading,
    isPremium,
    canUseScript,
    canUseTool,
    canTranscribe,
    canUseChat,
    canAccessDay,
    remainingScripts,
    remainingTools,
    remainingTranscriptions,
    remainingChat,
    incrementUsage,
    freeLimits: FREE_LIMITS,
  };
}
