import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface MonthlyProgressProps {
  completedDays: number;
  totalDays: number;
}

export function MonthlyProgress({ completedDays, totalDays }: MonthlyProgressProps) {
  const percentage = Math.round((completedDays / totalDays) * 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6 flex flex-col items-center gap-4"
    >
      <div className="flex items-center gap-2">
        <div className="gradient-icon-bg purple">
          <TrendingUp size={18} />
        </div>
        <h3 className="font-serif text-lg font-semibold">Progresso do Mês</h3>
      </div>

      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(258, 60%, 55%)" />
              <stop offset="100%" stopColor="hsl(280, 70%, 45%)" />
            </linearGradient>
          </defs>
          <motion.circle
            cx="50" cy="50" r="45" fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-serif">{completedDays}</span>
          <span className="text-xs text-muted-foreground">de {totalDays}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{percentage}% concluído</p>
    </motion.div>
  );
}
