import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Eye, MessageSquare, Target, Copy, Check, Sparkles, RotateCcw } from 'lucide-react';
import { DayStrategy } from '@/data/strategies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useUserUsage } from '@/hooks/useUserUsage';
import { CheckoutModal } from '@/components/CheckoutModal';

interface ScriptGeneratorProps {
  strategy: DayStrategy;
  primaryNiche?: string;
  contentStyle?: string;
}

interface ScriptContent {
  viralHook: string;
  storytellingBody: string;
  subtleConversion: string;
}

export function ScriptGenerator({ strategy, primaryNiche, contentStyle }: ScriptGeneratorProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiScript, setAiScript] = useState<ScriptContent | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showingAI, setShowingAI] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { canUseScript, remainingScripts, incrementUsage, isPremium } = useUserUsage();

  const activeScript: ScriptContent = showingAI && aiScript ? aiScript : strategy;
  const fullScript = `🎬 HOOK (0-3s):\n${activeScript.viralHook}\n\n📖 CORPO:\n${activeScript.storytellingBody}\n\n🎯 CTA:\n${activeScript.subtleConversion}`;

  const handleCopy = () => { navigator.clipboard.writeText(fullScript); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const invokeGenerate = async () => {
    const { data, error } = await supabase.functions.invoke('generate-script', {
      body: { day: strategy.day, title: strategy.title, pillar: strategy.pillar, pillarLabel: strategy.pillarLabel, viralHook: strategy.viralHook, storytellingBody: strategy.storytellingBody, subtleConversion: strategy.subtleConversion, primaryNiche: primaryNiche || '', contentStyle: contentStyle || 'casual', visceralElement: strategy.visceralElement || '' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleGenerateAI = async () => {
    if (!canUseScript) { toast({ title: 'Limite atingido', description: 'Assine para continuar.', variant: 'destructive' }); setCheckoutOpen(true); return; }
    setIsGeneratingAI(true);
    try {
      let data: ScriptContent;
      try { data = await invokeGenerate(); } catch { await new Promise(r => setTimeout(r, 2000)); data = await invokeGenerate(); }
      setAiScript(data); setShowingAI(true);
      await incrementUsage('script_generations');
    } catch (e: any) {
      toast({ title: 'Erro ao gerar com IA', description: 'Tente novamente.', variant: 'destructive' });
    } finally { setIsGeneratingAI(false); }
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-2xl font-bold">Gerador de Script</h2>
        <p className="text-muted-foreground text-sm">Dia {strategy.day} — {strategy.title}</p>
      </div>

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div key="button" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="flex justify-center">
            <Button onClick={() => setRevealed(true)} className="gold-gradient text-primary-foreground px-8 py-6 text-base font-semibold rounded-xl">
              <Wand2 size={20} /> Gerar Script do Dia
            </Button>
          </motion.div>
        ) : (
          <motion.div key="script" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
            {showingAI && (
              <div className="flex justify-center">
                <Badge className="bg-gradient-to-r from-ai-from to-ai-to text-primary-foreground border-0 px-3 py-1"><Sparkles size={12} className="mr-1" />Gerado por IA</Badge>
              </div>
            )}
            {isGeneratingAI ? (
              <div className="space-y-4">{[1, 2, 3].map(i => (<div key={i} className="glass-card p-5 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>))}</div>
            ) : (
              <>
                <ScriptSection icon={Eye} title="Hook Viral (0-3s)" content={activeScript.viralHook} highlight />
                <ScriptSection icon={MessageSquare} title="Corpo Narrativo" content={activeScript.storytellingBody} />
                <ScriptSection icon={Target} title="CTA — Conversão Sutil" content={activeScript.subtleConversion} />
              </>
            )}
            <div className="flex gap-3">
              <Button onClick={handleCopy} variant="outline" className="flex-1" disabled={isGeneratingAI}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copiado!' : 'Copiar Script'}</Button>
              <Button onClick={() => { setRevealed(false); setShowingAI(false); }} variant="ghost">Gerar Novamente</Button>
            </div>
            {showingAI ? (
              <div className="flex gap-3">
                <Button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex-1 bg-gradient-to-r from-ai-from to-ai-to text-primary-foreground"><Sparkles size={16} />{isGeneratingAI ? 'Gerando...' : 'Nova Versão com IA'}</Button>
                <Button onClick={() => setShowingAI(false)} variant="outline" className="flex-1"><RotateCcw size={16} />Voltar ao Original</Button>
              </div>
            ) : (
              <Button onClick={handleGenerateAI} disabled={isGeneratingAI} className="w-full bg-gradient-to-r from-ai-from to-ai-to text-primary-foreground">
                <Sparkles size={16} />{isGeneratingAI ? 'Gerando com IA...' : `✨ Gerar Versão com IA${!isPremium ? ` (${remainingScripts}/3)` : ''}`}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </motion.div>
  );
}

function ScriptSection({ icon: Icon, title, content, highlight }: { icon: any; title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`glass-card p-5 space-y-2 ${highlight ? 'sell-mode-glow' : ''}`}>
      <div className="flex items-center gap-2"><Icon size={16} className="text-primary" /><h4 className="font-serif font-semibold text-sm">{title}</h4></div>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}
