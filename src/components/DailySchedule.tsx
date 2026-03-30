import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, Lock, ChevronDown, Sparkles } from 'lucide-react';
import { DailyTaskState, TaskKey } from '@/hooks/useInfluencer';
import { DailyScheduleData, TimeBlock } from '@/data/dailySchedule';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import confetti from 'canvas-confetti';

interface DailyScheduleProps { schedule: DailyScheduleData; tasks: DailyTaskState; progress: number; onComplete: (task: TaskKey) => void; aiContent?: { contentTypes?: string[]; hooks?: string[]; videoFormats?: string[]; storytelling?: string[]; ctas?: string[]; cliffhangers?: string[]; } | null; }

function fireConfetti() { confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#C9A96E', '#D4C5A9', '#2D2D2D'] }); }

const blockColors: Record<string, string> = { morning: 'border-l-amber-400', afternoon: 'border-l-orange-400', night: 'border-l-indigo-400' };

function TaskItem({ taskKey, time, label, description, done, onComplete, examples }: { taskKey: TaskKey; time: string; label: string; description: string; done: boolean; onComplete: (task: TaskKey) => void; examples?: string[]; }) {
  const [showExamples, setShowExamples] = useState(false);
  const handleClick = () => { if (!done) { onComplete(taskKey); fireConfetti(); } };
  return (
    <div className={`w-full px-3 py-2.5 rounded-lg transition-all text-left ${done ? 'bg-primary/10 text-muted-foreground' : 'text-foreground'}`}>
      <motion.button onClick={handleClick} disabled={done} whileTap={{ scale: 0.97 }} className="w-full flex items-start gap-3">
        {done ? <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" /> : <Circle size={18} className="text-muted-foreground shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><Clock size={12} className="text-muted-foreground shrink-0" /><span className="text-xs text-muted-foreground">{time}</span></div>
          <span className={`text-sm font-medium ${done ? 'line-through' : ''}`}>{label}</span>
          {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </motion.button>
      {examples && examples.length > 0 && (
        <Collapsible open={showExamples} onOpenChange={setShowExamples}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 mt-2 ml-7 text-xs text-primary/70 hover:text-primary transition-colors">
              <Sparkles size={12} /><span>{showExamples ? 'Ocultar exemplos' : `Ver ${examples.length} exemplos`}</span><ChevronDown size={12} className={`transition-transform ${showExamples ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-7 mt-2 space-y-1.5 pb-1">
              {examples.map((ex, i) => (<div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2"><span className="text-primary/60 font-medium shrink-0">{i + 1}.</span><span className="leading-relaxed">{ex}</span></div>))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function ScheduleBlock({ block, tasks, onComplete }: { block: TimeBlock; tasks: DailyTaskState; onComplete: (task: TaskKey) => void; }) {
  const [open, setOpen] = useState(true);
  const completedCount = block.tasks.filter(t => { if (t.key === 'valueStories') return tasks.valueStories >= 5; return tasks[t.key as keyof DailyTaskState] === true; }).length;
  const allDone = completedCount === block.tasks.length;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full glass-card p-4 text-left border-l-4 ${blockColors[block.id]} transition-all hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-lg">{block.emoji}</span><div><h3 className="font-serif text-sm font-semibold">{block.title}</h3><p className="text-xs text-muted-foreground">{block.subtitle}</p></div></div>
            <Badge variant={allDone ? 'default' : 'secondary'} className="text-xs">{completedCount}/{block.tasks.length}</Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-2 space-y-1 mt-1">
          {block.tasks.map((task) => {
            const isDone = task.key === 'valueStories' ? tasks.valueStories >= 5 : tasks[task.key as keyof DailyTaskState] === true;
            const displayLabel = task.key === 'valueStories' ? `${task.label} (${tasks.valueStories}/5)` : task.label;
            return <TaskItem key={task.key} taskKey={task.key as TaskKey} time={task.time} label={displayLabel} description={task.description} done={isDone} onComplete={onComplete} examples={task.examples} />;
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DailySchedule({ schedule, tasks, progress, onComplete, aiContent }: DailyScheduleProps) {
  const [selectedCliffhanger, setSelectedCliffhanger] = useState<number | null>(null);
  const cliffhangerOptions = aiContent?.cliffhangers && aiContent.cliffhangers.length > 0 ? aiContent.cliffhangers : schedule.cliffhangerOptions;
  const handleCliffhangerSelect = (idx: number) => { if (!tasks.cliffhanger) { setSelectedCliffhanger(idx); onComplete('cliffhanger'); fireConfetti(); } };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><span className="text-lg">{schedule.weeklyTheme.emoji}</span><div><h3 className="font-serif text-sm font-semibold">{schedule.dayOfWeekName} — {schedule.weeklyTheme.name}</h3><p className="text-xs text-muted-foreground">{schedule.weeklyTheme.objective}</p></div></div>
          {schedule.isFeedDay && <Badge className="bg-primary/20 text-primary border-0 text-xs">📸 Dia de Feed</Badge>}
        </div>
        <Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground text-right mt-1">{progress}% concluído</p>
      </div>
      {schedule.blocks.map((block) => <ScheduleBlock key={block.id} block={block} tasks={tasks} onComplete={onComplete} />)}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-4 border-l-4 border-l-primary">
        <div className="flex items-start gap-3">
          {tasks.cliffhanger ? <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" /> : <Lock size={18} className="text-primary shrink-0 mt-0.5" />}
          <div className="flex-1">
            <h3 className="font-serif text-sm font-semibold flex items-center gap-2">🔒 Ciclo do Vício{aiContent?.cliffhangers && aiContent.cliffhangers.length > 0 && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70">✨ IA</Badge>}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">{tasks.cliffhanger ? 'Cliffhanger do dia ✅' : `Escolha 1 das ${cliffhangerOptions.length} opções`}</p>
            <div className="space-y-2">
              {cliffhangerOptions.map((text, idx) => {
                const isSelected = selectedCliffhanger === idx; const isDisabled = tasks.cliffhanger && !isSelected;
                return (<motion.button key={idx} whileTap={{ scale: tasks.cliffhanger ? 1 : 0.98 }} onClick={() => handleCliffhangerSelect(idx)} disabled={tasks.cliffhanger} className={`w-full text-left text-sm rounded-lg p-3 border transition-all ${isSelected ? 'border-primary bg-primary/10' : isDisabled ? 'border-border/30 bg-muted/20 opacity-50' : 'border-border/50 bg-muted/30 hover:border-primary/50'}`}><span className="italic leading-relaxed">"{text}"</span></motion.button>);
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
