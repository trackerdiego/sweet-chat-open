import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, MessageSquare, Target, Camera } from 'lucide-react';
import { DayStrategy, getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { Button } from '@/components/ui/button';

interface DayDetailCardProps {
  strategy: DayStrategy | null;
  onClose: () => void;
}

export function DayDetailCard({ strategy, onClose }: DayDetailCardProps) {
  return (
    <AnimatePresence>
      {strategy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${getPillarColor(strategy.pillar)}`}>
                  <NicheIcon id={strategy.pillar} fallbackEmoji={getPillarEmoji(strategy.pillar)} size={16} /> {strategy.pillarLabel}
                </span>
                <h2 className="font-serif text-2xl font-bold mt-2">
                  Dia {strategy.day}: {strategy.title}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>

            <Section icon={Eye} title="Hook Viral (0-3s)" content={strategy.viralHook} highlight />
            <Section icon={MessageSquare} title="Corpo Narrativo" content={strategy.storytellingBody} />
            <Section icon={Target} title="Conversão Sutil" content={strategy.subtleConversion} />
            <Section icon={Camera} title="Instruções Visuais" content={strategy.visualInstructions} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon: Icon, title, content, highlight }: { icon: any; title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 space-y-2 ${highlight ? 'gold-gradient text-primary-foreground' : 'bg-muted/50'}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}
