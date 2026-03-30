import { motion } from 'framer-motion';
import { Zap, Award, Star } from 'lucide-react';

interface StreakCounterProps {
  streak: number;
  points: number;
}

export function StreakCounter({ streak, points }: StreakCounterProps) {
  const milestones = [
    { days: 7, label: '7 dias', icon: Zap, reached: streak >= 7 },
    { days: 14, label: '14 dias', icon: Star, reached: streak >= 14 },
    { days: 30, label: '30 dias', icon: Award, reached: streak >= 30 },
  ];

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="gradient-icon-bg orange">
            <Zap size={18} />
          </div>
          <h3 className="font-serif text-lg font-semibold">Sequência</h3>
        </div>
        <div className="flex items-center gap-1.5 text-primary font-semibold text-sm">
          {streak} {streak === 1 ? 'dia' : 'dias'}
        </div>
      </div>

      <div className="flex justify-between gap-2">
        {milestones.map(({ days, label, icon: Icon, reached }) => (
          <div
            key={days}
            className={`flex flex-col items-center gap-1.5 flex-1 py-3 rounded-xl transition-all ${
              reached ? 'gold-gradient text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted/50 text-muted-foreground'
            }`}
          >
            <Icon size={18} />
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 pt-2">
        <Star size={16} className="text-primary" />
        <span className="font-semibold text-sm">{points} Pontos de Influência</span>
      </div>
    </motion.div>
  );
}
