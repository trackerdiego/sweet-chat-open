import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserUsage {
  script_generations: number;
  tool_generations: number;
  transcriptions: number;
  chat_messages: number;
  is_premium: boolean;
  last_script_date: string | null;
  last_tool_date: string | null;
  last_transcription_date: string | null;
  last_chat_date: string | null;
}

const FREE_LIMITS = {
  script_generations: 3,   // per day
  tool_generations: 2,     // per day
  transcriptions: 2,       // per day
  chat_messages: 10,       // per day
  free_days: 7,
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCountForToday(count: number, lastDate: string | null, today: string): number {
  return lastDate === today ? count : 0;
}

export function useUserUsage() {
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreate = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchOrCreate();
  }, [fetchOrCreate]);

  // Re-busca user_usage do banco. Usar após jobs assíncronos (script/tools/daily-guide/transcrição)
  // que incrementam server-side — evita dupla contagem e mantém UI sincronizada com admin.
  const refreshUsage = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase.from as any)('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setUsage(data as UserUsage);
  }, []);

  const isPremium = usage?.is_premium ?? false;
  const today = getTodayDate();

  const scriptCountToday = getCountForToday(usage?.script_generations ?? 0, usage?.last_script_date ?? null, today);
  const toolCountToday = getCountForToday(usage?.tool_generations ?? 0, usage?.last_tool_date ?? null, today);
  const transcriptionCountToday = getCountForToday(usage?.transcriptions ?? 0, usage?.last_transcription_date ?? null, today);
  const chatCountToday = getCountForToday(usage?.chat_messages ?? 0, usage?.last_chat_date ?? null, today);

  const canUseScript = isPremium || scriptCountToday < FREE_LIMITS.script_generations;
  const canUseTool = isPremium || toolCountToday < FREE_LIMITS.tool_generations;
  const canTranscribe = isPremium || transcriptionCountToday < FREE_LIMITS.transcriptions;
  const canUseChat = isPremium || chatCountToday < FREE_LIMITS.chat_messages;

  const canAccessDay = useCallback((day: number) => {
    return isPremium || day <= FREE_LIMITS.free_days;
  }, [isPremium]);

  const remainingScripts = isPremium ? Infinity : Math.max(0, FREE_LIMITS.script_generations - scriptCountToday);
  const remainingTools = isPremium ? Infinity : Math.max(0, FREE_LIMITS.tool_generations - toolCountToday);
  const remainingTranscriptions = isPremium ? Infinity : Math.max(0, FREE_LIMITS.transcriptions - transcriptionCountToday);
  const remainingChat = isPremium ? Infinity : Math.max(0, FREE_LIMITS.chat_messages - chatCountToday);

  const incrementUsage = useCallback(async (feature: 'script_generations' | 'tool_generations' | 'transcriptions' | 'chat_messages') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dateFieldMap: Record<string, string> = {
      script_generations: 'last_script_date',
      tool_generations: 'last_tool_date',
      transcriptions: 'last_transcription_date',
      chat_messages: 'last_chat_date',
    };

    const dateField = dateFieldMap[feature];
    const currentDateValue = (usage as any)?.[dateField] ?? null;
    const isNewDay = currentDateValue !== today;
    const newCount = isNewDay ? 1 : ((usage as any)?.[feature] ?? 0) + 1;

    const { error } = await (supabase.from as any)('user_usage')
      .update({ [feature]: newCount, [dateField]: today })
      .eq('user_id', user.id);

    if (!error) {
      setUsage(prev => prev ? { ...prev, [feature]: newCount, [dateField]: today } : prev);
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
    refreshUsage,
    freeLimits: FREE_LIMITS,
  };
}
