import { motion } from 'framer-motion';
import { ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { DayStrategy, getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { getDailyGuideContent } from '@/data/dailyGuideContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DailyGuideProps { strategy: DayStrategy; weeklyTheme?: string; onAiContent?: (content: AiGuideContent) => void; primaryNiche?: string; contentStyle?: string; }

export interface AiGuideContent { contentTypes?: string[]; hooks?: string[]; videoFormats?: string[]; storytelling?: string[]; ctas?: string[]; cliffhangers?: string[]; taskExamples?: Record<string, string[]>; }

type SectionAiKey = 'contentTypes' | 'hooks' | 'videoFormats' | 'storytelling' | 'ctas' | 'cliffhangers';
const sectionAiKeys: SectionAiKey[] = ['contentTypes', 'hooks', 'videoFormats', 'storytelling', 'ctas', 'cliffhangers'];

export function DailyGuide({ strategy, weeklyTheme, onAiContent, primaryNiche, contentStyle }: DailyGuideProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiContent, setAiContentLocal] = useState<AiGuideContent | null>(null);
  const sections = getDailyGuideContent(strategy);

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-guide', { body: { pillar: strategy.pillar, pillarLabel: strategy.pillarLabel, weeklyTheme: weeklyTheme || '', dayTitle: strategy.title, day: strategy.day, primaryNiche: primaryNiche || '', contentStyle: contentStyle || 'casual', visceralElement: strategy.visceralElement || '' } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const content = data as AiGuideContent;
      setAiContentLocal(content); onAiContent?.(content); setAiGenerated(true);
      toast.success('Sugestões personalizadas geradas com IA! ✨');
    } catch { toast.error('Erro ao gerar sugestões.'); } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full glass-card p-5 text-left transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <NicheIcon id={strategy.pillar} fallbackEmoji={getPillarEmoji(strategy.pillar)} size={20} />
                  <Badge className={getPillarColor(strategy.pillar) + ' border-0 text-xs'}>{strategy.pillarLabel}</Badge>
                  <span className="text-xs text-muted-foreground">Dia {strategy.day}</span>
                </div>
                <h2 className="font-serif text-lg font-semibold text-foreground">{strategy.title}</h2>
              </div>
              <ChevronDown size={20} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{open ? 'Fechar guia do dia' : '▼ Toque para abrir o Guia do Dia'}</p>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="glass-card mt-2 p-4 space-y-3">
            <Button onClick={handleGenerateAI} disabled={loading} variant={aiGenerated ? 'outline' : 'default'} className={`w-full ${!aiGenerated ? 'gold-gradient text-primary-foreground' : ''}`} size="sm">
              {loading ? <><Loader2 size={14} className="animate-spin" />Gerando...</> : aiGenerated ? <><Sparkles size={14} />✅ Regenerar com IA</> : <><Sparkles size={14} />✨ Gerar sugestões com IA</>}
            </Button>
            <Accordion type="multiple" className="space-y-0">
              {sections.map((section, idx) => {
                const aiKey = sectionAiKeys[idx];
                const aiItems = aiContent && aiKey ? aiContent[aiKey] : undefined;
                const items = aiItems && aiItems.length > 0 ? aiItems : section.items;
                const isAi = !!(aiItems && aiItems.length > 0);
                return (
                  <AccordionItem key={idx} value={`section-${idx}`} className="border-border/50">
                    <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                      <span className="flex items-center gap-2"><span>{section.icon}</span><span>{section.title}</span>{isAi && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70 ml-1">✨ IA</Badge>}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">{items.map((item, i) => (<li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-primary mt-0.5 shrink-0">•</span><span>{item}</span></li>))}</ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}
