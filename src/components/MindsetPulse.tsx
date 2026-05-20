import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { mindsetQuotes } from '@/data/quotes';

interface MindsetPulseProps {
  day: number;
}

export function MindsetPulse({ day }: MindsetPulseProps) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = mindsetQuotes[(dayOfYear - 1) % mindsetQuotes.length];

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="neon-card p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/40 text-[hsl(var(--primary-glow))]">
          <Sparkles size={16} />
        </div>
        <h3 className="font-serif text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dose de Coragem</h3>
      </div>
      <p className="font-serif text-lg leading-relaxed italic text-foreground">"{quote}"</p>
    </motion.div>

  );
}
