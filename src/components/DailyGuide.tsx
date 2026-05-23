import { motion } from 'framer-motion';
import { ChevronDown, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { DayStrategy, getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { getDailyGuideContent } from '@/data/dailyGuideContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface AiGuideContent { contentTypes?: string[]; hooks?: string[]; videoFormats?: string[]; storytelling?: string[]; ctas?: string[]; cliffhangers?: string[]; taskExamples?: Record<string, string[]>; }

type SectionAiKey = 'contentTypes' | 'hooks' | 'videoFormats' | 'storytelling' | 'ctas' | 'cliffhangers';
const sectionAiKeys: SectionAiKey[] = ['contentTypes', 'hooks', 'videoFormats', 'storytelling', 'ctas', 'cliffhangers'];

interface DailyGuideProps {
  strategy: DayStrategy;
  aiContent: AiGuideContent | null;
  isGenerating: boolean;
  isFirstLoad: boolean;
  onRegenerate: () => void;
  errorMessage?: string | null;
}

export function DailyGuide({ strategy, aiContent, isGenerating, isFirstLoad, onRegenerate, errorMessage }: DailyGuideProps) {
  const [open, setOpen] = useState(true);
  const sections = getDailyGuideContent(strategy);
  const personalized = !!aiContent;

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full glass-card p-5 text-left transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <NicheIcon id={strategy.pillar} fallbackEmoji={getPillarEmoji(strategy.pillar)} size={20} />
                  <Badge className={getPillarColor(strategy.pillar) + ' border-0 text-xs'}>{strategy.pillarLabel}</Badge>
                  <span className="text-xs text-muted-foreground">Dia {strategy.day}</span>
                  {personalized && (
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
                      <Sparkles size={10} className="mr-1" />Feito pra você
                    </Badge>
                  )}
                  {isFirstLoad && (
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-muted-foreground">
                      <Loader2 size={10} className="mr-1 animate-spin" />Personalizando…
                    </Badge>
                  )}
                </div>
                <h2 className="font-serif text-lg font-semibold text-foreground">{strategy.title}</h2>
              </div>
              <ChevronDown size={20} className={`text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {open ? 'Toque para fechar' : 'Toque para abrir as sugestões do dia'}
            </p>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="glass-card mt-2 p-4 space-y-3">
            {isFirstLoad && !aiContent && (
              <div className="text-xs text-center text-muted-foreground py-2 px-3 bg-primary/5 rounded-lg border border-primary/20">
                ⚡ Montando suas sugestões personalizadas… isso leva poucos segundos.
              </div>
            )}
            {errorMessage && !isFirstLoad && (
              <div className="text-xs text-center text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg">
                Mostrando sugestões base — a personalização falhou: {errorMessage}
              </div>
            )}

            <Accordion type="multiple" defaultValue={["section-0", "section-1"]} className="space-y-0">
              {sections.map((section, idx) => {
                const aiKey = sectionAiKeys[idx];
                const aiItems = aiContent && aiKey ? aiContent[aiKey] : undefined;
                const items = aiItems && aiItems.length > 0 ? aiItems : section.items;
                const isAi = !!(aiItems && aiItems.length > 0);
                return (
                  <AccordionItem key={idx} value={`section-${idx}`} className="border-border/50">
                    <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span>{section.icon}</span>
                        <span>{section.title}</span>
                        {isAi && <Sparkles size={11} className="text-primary" />}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <Button
              onClick={onRegenerate}
              disabled={isGenerating || isFirstLoad}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isGenerating ? (
                <><Loader2 size={14} className="animate-spin" />Gerando novas ideias…</>
              ) : (
                <><RefreshCw size={14} />Gerar outras ideias</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              Cada geração consome 1 das suas gerações diárias gratuitas. Premium é ilimitado.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}
