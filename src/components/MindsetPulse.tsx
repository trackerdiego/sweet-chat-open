import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { mindsetQuotes } from '@/data/quotes';

interface MindsetPulseProps {
  day: number;
}

export function MindsetPulse({ day }: MindsetPulseProps) {
  const quote = mindsetQuotes[(day - 1) % mindsetQuotes.length];

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="gradient-icon-bg blue">
          <Sparkles size={16} />
        </div>
        <h3 className="font-serif text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dose de Coragem</h3>
      </div>
      <p className="font-serif text-lg leading-relaxed italic text-foreground">"{quote}"</p>
    </motion.div>
  );
}
