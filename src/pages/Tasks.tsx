import { motion } from 'framer-motion';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserUsage } from '@/hooks/useUserUsage';
import { useDailyGuideCache } from '@/hooks/useDailyGuideCache';
import { DailySchedule } from '@/components/DailySchedule';
import { DailyGuide, AiGuideContent } from '@/components/DailyGuide';
import { PremiumGate } from '@/components/PremiumGate';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpButton } from '@/components/HelpButton';
import { PageBackdrop } from '@/components/PageBackdrop';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const Tasks = () => {
  const { strategies, loading } = useUserStrategies();
  const { state, todayTasks, dailyProgress, completeTask, schedule } = useInfluencer(strategies);
  const { profile } = useUserProfile();
  const { canAccessDay } = useUserUsage();
  const todayStrategy = strategies[state.currentDay - 1];
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const cache = useDailyGuideCache({
    enabled: !!todayStrategy && !!userId,
    userId,
    day: state.currentDay,
    pillar: todayStrategy?.pillar || '',
    pillarLabel: todayStrategy?.pillarLabel || '',
    dayTitle: todayStrategy?.title || '',
    weeklyTheme: schedule?.weeklyTheme.name || '',
    primaryNiche: profile?.primary_niche,
    contentStyle: profile?.content_style,
    visceralElement: todayStrategy?.visceralElement,
  });

  // Permite que o DailySchedule sobrescreva taskExamples (via job de diversificação)
  const [overrideTaskExamples, setOverrideTaskExamples] = useState<Record<string, string[]> | null>(null);
  const handleAiTaskExamples = (examples: Record<string, string[]>) => {
    setOverrideTaskExamples((prev) => ({ ...(prev || {}), ...examples }));
  };
  const effectiveAi: AiGuideContent | null = cache.content
    ? { ...cache.content, taskExamples: { ...(cache.content.taskExamples || {}), ...(overrideTaskExamples || {}) } }
    : (overrideTaskExamples ? { taskExamples: overrideTaskExamples } : null);

  const dayLocked = !canAccessDay(state.currentDay);

  const realDate = new Date();
  const formattedDate = format(realDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (loading || strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
        <PageBackdrop />
        <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="relative z-10 px-4 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-[120px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
      <PageBackdrop />

      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Dia {state.currentDay} de 30 — {displayDate}
            </p>
          </div>
          <HelpButton topic="tarefas" />
        </motion.div>
      </div>

      <div className="relative z-10 px-4 max-w-lg mx-auto space-y-4">
        <PremiumGate locked={dayLocked} message="Assine para desbloquear as tarefas a partir do dia 8">
          {todayStrategy && (
            <DailyGuide
              strategy={todayStrategy}
              aiContent={effectiveAi}
              isGenerating={cache.isGenerating}
              isFirstLoad={cache.isFirstLoad}
              onRegenerate={cache.regenerate}
              errorMessage={cache.error}
            />
          )}

          {schedule && todayStrategy && (
            <DailySchedule
              schedule={schedule}
              tasks={todayTasks}
              progress={dailyProgress}
              onComplete={completeTask}
              aiContent={effectiveAi}
              day={state.currentDay}
              pillar={todayStrategy.pillar}
              pillarLabel={todayStrategy.pillarLabel}
              dayTitle={todayStrategy.title}
              primaryNiche={profile?.primary_niche}
              contentStyle={profile?.content_style}
              onAiTaskExamples={handleAiTaskExamples}
            />
          )}
        </PremiumGate>
      </div>
    </div>
  );
};

export default Tasks;
