// HypeOfTheDay — card de tendências do dia personalizadas pro nicho do criador.
// Lê de user_daily_hype (cache 24h); se vazio, dispara job assíncrono.

import { motion } from 'framer-motion';
import { Flame, TrendingUp, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDailyHype, type HypeItem } from '@/hooks/useDailyHype';
import { useToast } from '@/hooks/use-toast';

const SOURCE_LABEL: Record<string, string> = {
  google_trends: 'Google',
  reddit: 'Reddit',
  youtube: 'YouTube',
};

export function HypeOfTheDay() {
  const { items, loading, error, reload } = useDailyHype();
  const [open, setOpen] = useState<HypeItem | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Gancho copiado!', description: 'Cole no seu app de gravação.' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold">Hype do dia</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <p className="text-xs text-muted-foreground">Vasculhando tendências do Brasil pra você…</p>
      </div>
    );
  }

  if (error || !items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Hype do dia</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} className="h-7 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {error || 'Sem tendências no momento. Tente novamente em instantes.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-card/40 to-pink-500/5 backdrop-blur p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Hype do dia</span>
            <span className="text-xs text-muted-foreground">— top 5 pro seu nicho</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} className="h-7 px-2 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => setOpen(item)}
              className="w-full text-left p-3 rounded-xl bg-background/60 hover:bg-background/90 border border-border/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-500">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium truncate">{item.tema}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.porque_bombou}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      {item.formato_sugerido}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {SOURCE_LABEL[item.fonte] || item.fonte}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground self-center flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          {open && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-xs uppercase tracking-wide text-orange-500 font-semibold">Tendência</span>
                </div>
                <SheetTitle className="text-2xl pr-6">{open.tema}</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1.5 font-medium">Por que bombou</p>
                  <p className="text-sm">{open.porque_bombou}</p>
                </div>

                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1.5 font-medium">Como conectar ao seu nicho</p>
                  <p className="text-sm">{open.angulo}</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-500/20">
                  <p className="text-xs uppercase text-orange-500 mb-2 font-semibold">Gancho pronto pra gravar</p>
                  <p className="text-base leading-relaxed font-medium">{open.gancho}</p>
                  <Button
                    onClick={() => handleCopy(open.gancho)}
                    size="sm"
                    className="mt-3 w-full"
                    variant="secondary"
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Copiado!' : 'Copiar gancho'}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <span>Formato sugerido: <strong className="text-foreground">{open.formato_sugerido}</strong></span>
                  <span>Fonte: {SOURCE_LABEL[open.fonte] || open.fonte}</span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
