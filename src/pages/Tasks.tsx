import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserUsage } from '@/hooks/useUserUsage';
import { DailySchedule } from '@/components/DailySchedule';
import { DailyGuide, AiGuideContent } from '@/components/DailyGuide';
import { PremiumGate } from '@/components/PremiumGate';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Tasks = () => {
  const { strategies, loading } = useUserStrategies();
  const { state, todayTasks, dailyProgress, completeTask, schedule } = useInfluencer(strategies);
  const { profile } = useUserProfile();
  const { canAccessDay } = useUserUsage();
  const todayStrategy = strategies[state.currentDay - 1];
  const [aiContent, setAiContent] = useState<AiGuideContent | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const dayLocked = !canAccessDay(state.currentDay);

  const realDate = new Date();
  const formattedDate = format(realDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (loading || strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20">
        <div className="gradient-header px-4 pt-6 pb-10 rounded-b-3xl">
          <div className="max-w-lg mx-auto">
            <Skeleton className="h-8 w-32 bg-white/20" />
            <Skeleton className="h-4 w-48 mt-2 bg-white/10" />
          </div>
        </div>
        <div className="px-4 max-w-lg mx-auto space-y-4 -mt-5">
          <Skeleton className="h-[120px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pt-20">
      <div className="gradient-header px-4 pt-6 pb-10 rounded-b-3xl">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-lg mx-auto">
          <h1 className="font-serif text-3xl font-bold text-white">Tarefas</h1>
          <p className="text-white/60 text-sm mt-1">
            Dia {state.currentDay} de 30 — {displayDate}
          </p>
        </motion.div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4 -mt-5">
        <PremiumGate locked={dayLocked} message="Assine para desbloquear as tarefas a partir do dia 8">
          {todayStrategy && (
            <DailyGuide
              strategy={todayStrategy}
              weeklyTheme={schedule?.weeklyTheme.name}
              onAiContent={setAiContent}
              primaryNiche={profile?.primary_niche}
              contentStyle={profile?.content_style}
            />
          )}

          {schedule && (
            <DailySchedule
              schedule={schedule}
              tasks={todayTasks}
              progress={dailyProgress}
              onComplete={completeTask}
              aiContent={aiContent}
            />
          )}
        </PremiumGate>
      </div>

      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

export default Tasks;
