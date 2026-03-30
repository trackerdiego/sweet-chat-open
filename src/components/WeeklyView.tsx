import { motion } from 'framer-motion';
import { DayStrategy, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';

interface WeeklyViewProps {
  currentDay: number;
  completedDays: number[];
  strategies: DayStrategy[];
}

export function WeeklyView({ currentDay, completedDays, strategies }: WeeklyViewProps) {
  const weekStart = Math.floor((currentDay - 1) / 7) * 7 + 1;
  const weekDays = strategies.slice(weekStart - 1, weekStart + 6);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="glass-card p-5 space-y-3"
    >
      <h3 className="font-serif text-lg font-semibold">Visão Semanal</h3>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day) => {
          const isToday = day.day === currentDay;
          const isDone = completedDays.includes(day.day);

          return (
            <div
              key={day.day}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all ${
                isToday
                  ? 'ring-2 ring-primary bg-primary/10'
                  : isDone
                  ? 'bg-primary/5'
                  : 'bg-muted/30'
              }`}
            >
              <span className="text-xs text-muted-foreground">D{day.day}</span>
              <NicheIcon id={day.pillar} fallbackEmoji={getPillarEmoji(day.pillar)} size={24} />
              <span className="text-[10px] leading-tight text-muted-foreground truncate w-full">
                {day.pillarLabel}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
