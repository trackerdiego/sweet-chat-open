import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, Award, Star, Coins } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

interface StreakCounterProps {
  streak: number;
  /** @deprecated mantido por compatibilidade — agora exibimos o saldo de Coins da carteira */
  points?: number;
}

export function StreakCounter({ streak }: StreakCounterProps) {
  const navigate = useNavigate();
  const { wallet } = useWallet();

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

      <button
        type="button"
        onClick={() => navigate('/carteira')}
        className="w-full flex items-center justify-center gap-2 pt-2 hover:opacity-80 transition-opacity"
        aria-label="Ver minha carteira de coins"
      >
        <Coins size={16} className="text-primary" />
        <span className="font-semibold text-sm">
          {wallet.coins_balance.toLocaleString('pt-BR')} {wallet.coins_balance === 1 ? 'coin' : 'coins'}
        </span>
        <span className="text-xs text-muted-foreground">· ver carteira</span>
      </button>
    </motion.div>
  );
}
