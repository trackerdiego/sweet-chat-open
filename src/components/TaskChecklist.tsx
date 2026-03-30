import { motion } from 'framer-motion';
import { Video, Camera, Image, CheckCircle2, Circle } from 'lucide-react';
import { DailyTaskState } from '@/hooks/useInfluencer';
import confetti from 'canvas-confetti';
import { Progress } from '@/components/ui/progress';

interface TaskChecklistProps {
  tasks: DailyTaskState;
  progress: number;
  onComplete: (task: 'reel' | 'valueStories' | 'feedPost') => void;
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#C9A96E', '#D4C5A9', '#2D2D2D'],
  });
}

export function TaskChecklist({ tasks, progress, onComplete }: TaskChecklistProps) {
  const handleComplete = (task: 'reel' | 'valueStories' | 'feedPost') => {
    onComplete(task);
    fireConfetti();
  };

  const taskItems = [
    {
      key: 'reel' as const,
      icon: Video,
      label: '1x Reels Estratégico',
      done: tasks.reel,
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      key: 'valueStories' as const,
      icon: Camera,
      label: `Story ${i + 1}/5`,
      done: tasks.valueStories > i,
    })),
    {
      key: 'feedPost' as const,
      icon: Image,
      label: '1x Post Feed Lifestyle',
      done: tasks.feedPost,
    },
  ];

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-5 space-y-4"
    >
      <h3 className="font-serif text-lg font-semibold">Tarefas do Dia</h3>

      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground text-right">{progress}% concluído</p>

      <div className="space-y-2">
        {taskItems.map((item, i) => (
          <motion.button
            key={`${item.key}-${i}`}
            onClick={() => !item.done && handleComplete(item.key)}
            disabled={item.done}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm text-left ${
              item.done
                ? 'bg-primary/10 text-muted-foreground'
                : 'hover:bg-muted/50 text-foreground'
            }`}
          >
            {item.done ? (
              <CheckCircle2 size={18} className="text-primary shrink-0" />
            ) : (
              <Circle size={18} className="text-muted-foreground shrink-0" />
            )}
            <item.icon size={16} className="shrink-0" />
            <span className={item.done ? 'line-through' : ''}>{item.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
