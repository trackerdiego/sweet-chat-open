import { motion } from 'framer-motion';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserUsage } from '@/hooks/useUserUsage';
import { getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { MonthlyProgress } from '@/components/MonthlyProgress';
import { StreakCounter } from '@/components/StreakCounter';
import { MindsetPulse } from '@/components/MindsetPulse';
import { WeeklyView } from '@/components/WeeklyView';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ChevronRight, Calendar, LogOut, Crown, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

const Index = () => {
  const { strategies, loading: strategiesLoading, hasPersonalized } = useUserStrategies();
  const { state, dailyProgress, completedDays } = useInfluencer(strategies);
  const { profile, signOut } = useUserProfile();
  const { isPremium, freeLimits } = useUserUsage();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Só mostra skeleton se ainda não temos NENHUMA estratégia (nem fallback).
  // Como useUserStrategies inicia com fallbackStrategies, isso é raro — só
  // num primeiríssimo render antes do useEffect rodar.
  if (strategiesLoading && strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20">
        <div className="gradient-header px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 rounded-b-3xl">
          <div className="max-w-lg mx-auto space-y-3">
            <Skeleton className="h-5 w-32 bg-white/20" />
            <Skeleton className="h-9 w-48 bg-white/20" />
            <Skeleton className="h-4 w-56 bg-white/20" />
          </div>
        </div>
        <div className="px-4 max-w-lg mx-auto space-y-4 -mt-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const todayStrategy = strategies[state.currentDay - 1];
  const displayName = profile?.display_name || 'Creator';


  return (
    <div className="min-h-screen pb-24 md:pt-20">
      <div className="gradient-header px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 rounded-b-3xl">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-lg mx-auto space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-white/70 text-sm flex items-center gap-1.5">
              <Calendar size={14} /> Dia {state.currentDay} de 30
            </p>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-white/70 hover:text-white hover:bg-white/10">
              <LogOut size={18} />
            </Button>
          </div>
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold text-white">
              Olá, {displayName} 👑
            </h1>
            <p className="text-white/60 text-sm">Sua jornada de influência continua</p>
          </div>
        </motion.div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4 -mt-6">
        {!hasPersonalized && profile?.onboarding_completed && profile?.description_status === 'ok' && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-card p-4 border border-primary/20 bg-primary/5 flex items-center gap-3"
          >
            <Loader2 size={18} className="text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Finalizando sua matriz personalizada…</p>
              <p className="text-xs text-muted-foreground">
                Aparece automaticamente em instantes. Você já pode explorar o app.
              </p>
            </div>
          </motion.div>
        )}
        {profile && profile.description_status === 'pending' && profile.onboarding_completed && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-card p-4 border border-amber-500/20 bg-amber-500/5"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Sua descrição de público está incompleta</p>
                <p className="text-xs text-muted-foreground">
                  Sem uma descrição detalhada, o estudo de público e a matriz de conteúdo não serão precisos. Atualize para ter resultados melhores!
                </p>
                <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={() => navigate('/onboarding')}>
                  Atualizar descrição
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        {!isPremium && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-card p-4 flex items-center justify-between gap-3 border border-primary/20"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Crown size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Plano Gratuito</p>
                <p className="text-xs text-muted-foreground">
                  {state.currentDay <= freeLimits.free_days
                    ? `${freeLimits.free_days - state.currentDay + 1} dias grátis restantes`
                    : 'Desbloqueie os 30 dias completos'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setCheckoutOpen(true)} className="gold-gradient text-primary-foreground shrink-0">
              Assinar
            </Button>
          </motion.div>
        )}

        <MindsetPulse day={state.currentDay} />
        <MonthlyProgress completedDays={completedDays.length} totalDays={30} />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Link to="/script" className="block glass-card p-5 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${getPillarColor(todayStrategy.pillar)}`}>
                  <NicheIcon id={todayStrategy.pillar} fallbackEmoji={getPillarEmoji(todayStrategy.pillar)} size={16} /> {todayStrategy.pillarLabel}
                </span>
                <h3 className="font-serif text-lg font-semibold">
                  {todayStrategy.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {todayStrategy.viralHook}
                </p>
              </div>
              <ChevronRight size={20} className="text-muted-foreground mt-2 group-hover:text-primary transition-colors" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full gold-gradient transition-all duration-500"
                  style={{ width: `${dailyProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{dailyProgress}%</span>
            </div>
          </Link>
        </motion.div>

        <StreakCounter streak={state.streak} points={state.influencePoints} />
        <WeeklyView currentDay={state.currentDay} completedDays={completedDays} strategies={strategies} />
      </div>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

export default Index;
