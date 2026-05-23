// useDailyGuideCache — busca/cacheia o guia personalizado do dia.
// Fluxo: 1) tenta SELECT em daily_guide_cache(user_id, day, date). 2) Se não houver,
// dispara start-daily-guide-job em background com polling via useAiJob. 3) Quando o
// job termina, salva no cache via worker (upsert server-side) e devolve `content`.
// Visitas subsequentes no mesmo dia/usuário são instantâneas.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAiJob } from '@/hooks/useAiJob';
import type { AiGuideContent } from '@/components/DailyGuide';

interface UseDailyGuideCacheParams {
  enabled: boolean;
  userId: string | null | undefined;
  day: number;
  pillar: string;
  pillarLabel: string;
  dayTitle: string;
  weeklyTheme: string;
  primaryNiche?: string;
  contentStyle?: string;
  visceralElement?: string;
}

const todayIso = () => new Date().toISOString().split('T')[0];

export function useDailyGuideCache(params: UseDailyGuideCacheParams) {
  const [content, setContent] = useState<AiGuideContent | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const triggeredKeyRef = useRef<string | null>(null);
  const job = useAiJob<AiGuideContent>('daily_guide');

  const { enabled, userId, day, pillar, pillarLabel, dayTitle, weeklyTheme, primaryNiche, contentStyle, visceralElement } = params;
  const key = enabled && userId ? `${userId}:${day}:${todayIso()}` : null;

  // 1) lê cache
  useEffect(() => {
    if (!enabled || !userId || !day) { setLoadingCache(false); return; }
    let alive = true;
    setLoadingCache(true);
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: err } = await (supabase as any)
          .from('daily_guide_cache')
          .select('content, task_examples')
          .eq('user_id', userId)
          .eq('day', day)
          .eq('date', todayIso())
          .maybeSingle();
        if (!alive) return;
        if (err) {
          console.warn('[useDailyGuideCache] select error', err);
        }
        if (data?.content) {
          const merged = { ...(data.content as Record<string, unknown>), taskExamples: data.task_examples || {} } as AiGuideContent;
          setContent(merged);
        }
      } catch (e) {
        console.warn('[useDailyGuideCache] select threw', e);
      } finally {
        if (alive) setLoadingCache(false);
      }
    })();
    return () => { alive = false; };
  }, [enabled, userId, day]);

  // 2) se não houver cache E ainda não disparamos, dispara o job
  useEffect(() => {
    if (!enabled || !userId || !day || !pillar || !dayTitle) return;
    if (loadingCache) return;
    if (content) return;
    if (!key) return;
    if (triggeredKeyRef.current === key) return;
    if (job.isLoading) return;
    triggeredKeyRef.current = key;
    job.start({
      pillar, pillarLabel, weeklyTheme: weeklyTheme || '', dayTitle, day,
      primaryNiche: primaryNiche || '', contentStyle: contentStyle || 'casual',
      visceralElement: visceralElement || '',
      persistCache: true,
    }).catch((e) => {
      console.warn('[useDailyGuideCache] start failed', e);
      setError(e instanceof Error ? e.message : 'Falha ao personalizar');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, day, pillar, pillarLabel, dayTitle, weeklyTheme, primaryNiche, contentStyle, visceralElement, loadingCache, content, key]);

  // 3) quando o job termina, adota como content
  useEffect(() => {
    if (job.status === 'done' && job.result) {
      setContent(job.result);
      setError(null);
    }
    if (job.status === 'failed' && job.error) {
      setError(job.error);
    }
  }, [job.status, job.result, job.error]);

  const regenerate = useCallback(async () => {
    if (!enabled || !userId) return;
    triggeredKeyRef.current = key;
    setError(null);
    try {
      await job.start({
        pillar, pillarLabel, weeklyTheme: weeklyTheme || '', dayTitle, day,
        primaryNiche: primaryNiche || '', contentStyle: contentStyle || 'casual',
        visceralElement: visceralElement || '',
        persistCache: true,
        force: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao regenerar');
    }
  }, [enabled, userId, key, job, pillar, pillarLabel, weeklyTheme, dayTitle, day, primaryNiche, contentStyle, visceralElement]);

  const isGenerating = job.isLoading;
  const isReady = !!content;
  const isFirstLoad = loadingCache || (!content && job.isLoading);

  return { content, isReady, isGenerating, isFirstLoad, error, regenerate };
}
