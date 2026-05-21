import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { DayDetailCard } from '@/components/DayDetailCard';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserUsage } from '@/hooks/useUserUsage';
import { PremiumGate } from '@/components/PremiumGate';
import { CheckCircle2, Lock, ArrowUpRight, Sparkles, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpButton } from '@/components/HelpButton';
import { useAppTheme } from '@/hooks/useAppTheme';

const Matrix = () => {
  const { strategies, loading: strategiesLoading } = useUserStrategies();
  const { state, completedDays } = useInfluencer(strategies);
  const { canAccessDay } = useUserUsage();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { isDark } = useAppTheme();

  const pillars = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of strategies) {
      if (!seen.has(s.pillar)) seen.set(s.pillar, s.pillarLabel);
    }
    return [
      { key: 'all', label: 'Todos' },
      ...Array.from(seen.entries()).map(([key, label]) => ({ key, label })),
    ];
  }, [strategies]);

  if (strategiesLoading || strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="max-w-lg mx-auto space-y-5">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? strategies : strategies.filter(s => s.pillar === filter);
  const selectedStrategy = selectedDay ? strategies[selectedDay - 1] : null;
  const selectedDayLocked = selectedDay ? !canAccessDay(selectedDay) : false;

  const todayStrategy = strategies[state.currentDay - 1];
  const nextStrategy = strategies[state.currentDay] ?? null;
  const completedCount = completedDays.length;

  return (
    <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
      {isDark && (
        <>
          <div className="app-neon-orb" style={{ width: 420, height: 420, background: 'hsl(270 95% 60%)', top: -160, left: -140 }} />
          <div className="app-neon-orb" style={{ width: 320, height: 320, background: 'hsl(322 90% 60%)', top: 280, right: -120 }} />
        </>
      )}

      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-lg mx-auto flex items-start justify-between gap-3"
        >
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium tracking-wide">SUA JORNADA</p>
            <h1 className="font-sans text-[28px] leading-tight font-extrabold tracking-tight text-foreground">
              Matriz <span className="bg-clip-text text-transparent bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))]">30 dias</span>
            </h1>
          </div>
          <HelpButton topic="matriz" />
        </motion.div>
      </div>

      <div className="relative z-10 px-4 max-w-lg mx-auto space-y-6">
        {/* BENTO HERO */}
        {todayStrategy && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="grid grid-cols-5 gap-3 h-[200px]"
          >
            {/* Card grande - dia atual */}
            <button
              onClick={() => setSelectedDay(state.currentDay)}
              className="col-span-3 relative rounded-3xl p-4 text-left overflow-hidden group bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.5)] hover:shadow-[0_18px_50px_-8px_hsl(var(--primary)/0.65)] transition-all"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex flex-col h-full justify-between">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <NicheIcon id={todayStrategy.pillar} fallbackEmoji={getPillarEmoji(todayStrategy.pillar)} size={20} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center group-hover:bg-white/25 transition">
                    <ArrowUpRight size={16} className="text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="inline-block text-[10px] font-bold tracking-widest text-white/80 uppercase">Hoje · Dia {state.currentDay}</span>
                  <h3 className="text-white font-bold text-base leading-tight line-clamp-2">{todayStrategy.title}</h3>
                </div>
              </div>
            </button>

            {/* 2 cards menores */}
            <div className="col-span-2 grid grid-rows-2 gap-3">
              <div className="rounded-2xl p-3 border border-border bg-card/60 backdrop-blur flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Sparkles size={16} className="text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wide">FEITOS</span>
                </div>
                <p className="font-extrabold text-2xl text-foreground leading-none">
                  {completedCount}<span className="text-muted-foreground text-sm font-bold">/30</span>
                </p>
              </div>
              {nextStrategy ? (
                <button
                  onClick={() => setSelectedDay(nextStrategy.day)}
                  className="rounded-2xl p-3 border border-border bg-card/60 backdrop-blur flex flex-col justify-between text-left hover:border-primary/40 transition group"
                >
                  <div className="flex items-center justify-between">
                    <Calendar size={16} className="text-accent" />
                    <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-wide">PRÓXIMO · D{nextStrategy.day}</p>
                    <p className="font-bold text-xs text-foreground line-clamp-1 mt-0.5">{nextStrategy.title}</p>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl p-3 border border-border bg-card/60 backdrop-blur flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wide">FIM DA JORNADA</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* SEÇÃO PILARES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-lg font-extrabold tracking-tight text-foreground">Pilares</h2>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-xs font-semibold text-primary hover:underline">
                Limpar
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {pillars.map(p => {
              const active = filter === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setFilter(p.key)}
                  className={`shrink-0 text-xs px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-foreground text-background shadow-md'
                      : 'bg-transparent text-muted-foreground border border-border hover:border-foreground/40 hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* LISTA DE DIAS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-lg font-extrabold tracking-tight text-foreground">Estratégias</h2>
            <span className="text-xs text-muted-foreground font-medium">{filtered.length} dias</span>
          </div>

          <div className="space-y-2">
            {filtered.map((day, i) => {
              const isCurrent = day.day === state.currentDay;
              const isDone = completedDays.includes(day.day);
              const isLocked = !canAccessDay(day.day);

              return (
                <motion.button
                  key={day.day}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => setSelectedDay(day.day)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border bg-card/60 backdrop-blur text-left transition-all hover:border-primary/40 hover:bg-card group ${
                    isCurrent ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_8px_24px_-8px_hsl(var(--primary)/0.4)]' : 'border-border'
                  } ${isLocked ? 'opacity-70' : ''}`}
                >
                  {/* Ícone quadrado colorido */}
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${getPillarColor(day.pillar)}`}>
                    <NicheIcon id={day.pillar} fallbackEmoji={getPillarEmoji(day.pillar)} size={22} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground tracking-wide">DIA {day.day}</span>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] font-medium text-muted-foreground line-clamp-1">{day.pillarLabel}</span>
                    </div>
                    <h4 className={`font-bold text-sm text-foreground leading-tight line-clamp-1 mt-0.5 ${isLocked ? 'blur-[2px]' : ''}`}>
                      {day.title}
                    </h4>
                  </div>

                  {/* Estado direita */}
                  <div className="shrink-0">
                    {isLocked ? (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Lock size={13} className="text-muted-foreground" />
                      </div>
                    ) : isCurrent ? (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-white">
                        HOJE
                      </span>
                    ) : isDone ? (
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-primary" />
                      </div>
                    ) : (
                      <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary transition" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDayLocked ? (
        <PremiumGate locked message="Desbloqueie os 30 dias completos para ver esta estratégia">
          <DayDetailCard strategy={selectedStrategy} onClose={() => setSelectedDay(null)} />
        </PremiumGate>
      ) : (
        <DayDetailCard strategy={selectedStrategy} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
};

export default Matrix;
