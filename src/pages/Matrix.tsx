import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { DayDetailCard } from '@/components/DayDetailCard';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserUsage } from '@/hooks/useUserUsage';
import { PremiumGate } from '@/components/PremiumGate';
import { CheckCircle2, Lock } from 'lucide-react';

const Matrix = () => {
  const { strategies } = useUserStrategies();
  const { state, completedDays } = useInfluencer(strategies);
  const { canAccessDay, isPremium } = useUserUsage();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const pillars = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of strategies) {
      if (!seen.has(s.pillar)) seen.set(s.pillar, s.pillarLabel);
    }
    return [
      { key: 'all', label: 'Todos' },
      ...Array.from(seen.entries()).map(([key, label]) => ({
        key,
        label: `${getPillarEmoji(key)} ${label}`,
      })),
    ];
  }, [strategies]);

  const filtered = filter === 'all' ? strategies : strategies.filter(s => s.pillar === filter);
  const selectedStrategy = selectedDay ? strategies[selectedDay - 1] : null;
  const selectedDayLocked = selectedDay ? !canAccessDay(selectedDay) : false;

  return (
    <div className="min-h-screen pb-24 md:pt-20">
      <div className="gradient-header px-4 pt-6 pb-10 rounded-b-3xl">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-lg mx-auto">
          <h1 className="font-serif text-3xl font-bold text-white">Matriz 30 Dias</h1>
          <p className="text-white/60 text-sm mt-1">Sua biblioteca completa de estratégias</p>
        </motion.div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4 -mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {pillars.map(p => (
            <button
              key={p.key}
              onClick={() => setFilter(p.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                filter === p.key ? 'gold-gradient text-primary-foreground shadow-md shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted border border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((day, i) => {
            const isCurrent = day.day === state.currentDay;
            const isDone = completedDays.includes(day.day);
            const isLocked = !canAccessDay(day.day);

            return (
              <motion.button
                key={day.day}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedDay(day.day)}
                className={`glass-card p-4 text-left hover:shadow-lg transition-all group relative ${
                  isCurrent ? 'ring-2 ring-primary' : ''
                } ${isLocked ? 'opacity-70' : ''}`}
              >
                {isLocked && (
                  <div className="absolute top-2 right-2">
                    <Lock size={12} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Dia {day.day}</span>
                  {isDone && <CheckCircle2 size={14} className="text-primary" />}
                </div>
                <h4 className={`font-serif font-semibold text-sm mb-2 group-hover:text-primary transition-colors ${isLocked ? 'blur-[3px]' : ''}`}>
                  {day.title}
                </h4>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${getPillarColor(day.pillar)}`}>
                  <NicheIcon id={day.pillar} fallbackEmoji={getPillarEmoji(day.pillar)} size={14} /> {day.pillarLabel}
                </span>
              </motion.button>
            );
          })}
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
