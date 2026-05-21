// HypeOfTheDay — HERO do painel. Grid neon de tendências do dia personalizadas.

import { motion } from 'framer-motion';
import { Flame, TrendingUp, Copy, Check, RefreshCw, Youtube, Search, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useDailyHype, type HypeItem } from '@/hooks/useDailyHype';
import { useToast } from '@/hooks/use-toast';

const SOURCE_META: Record<string, { label: string; Icon: typeof Youtube; color: string }> = {
  youtube: { label: 'YouTube', Icon: Youtube, color: 'hsl(0 85% 60%)' },
  google_trends: { label: 'Google', Icon: Search, color: 'hsl(210 90% 60%)' },
  reddit: { label: 'Reddit', Icon: MessageCircle, color: 'hsl(15 90% 55%)' },
  evergreen: { label: 'Evergreen', Icon: Flame, color: 'hsl(270 90% 65%)' },
};

function sourceMeta(s: string) {
  return SOURCE_META[s] || { label: s, Icon: Flame, color: 'hsl(270 90% 65%)' };
}

export function HypeOfTheDay() {
  const { items, loading, error, reload } = useDailyHype();
  const [open, setOpen] = useState<HypeItem | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (items || []).forEach((i) => { map[i.fonte] = (map[i.fonte] || 0) + 1; });
    return map;
  }, [items]);

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
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="font-serif text-xl font-semibold">Hype do dia</h2>
          </div>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Vasculhando tendências do Brasil pra você…</p>
      </section>
    );
  }

  if (error || !items || items.length === 0) {
    return (
      <section className="app-neon-border soft p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="font-serif text-lg font-semibold">Hype do dia</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} className="h-8 px-2">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {error || 'Sem tendências no momento. Tente novamente em instantes.'}
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-semibold leading-tight">Hype do dia</h2>
              <p className="text-[11px] text-muted-foreground">{items.length} tendências pro seu nicho</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={reload} className="h-8 px-2 text-muted-foreground shrink-0">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </header>

        {/* Counters por fonte */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([src, n]) => {
            const m = sourceMeta(src);
            const Icon = m.Icon;
            return (
              <span
                key={src}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border/60 bg-card/50 text-muted-foreground"
              >
                <Icon className="w-3 h-3" style={{ color: m.color }} />
                {m.label} <strong className="text-foreground">{n}</strong>
              </span>
            );
          })}
        </div>

        {/* Grid neon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item, i) => {
            const m = sourceMeta(item.fonte);
            const Icon = m.Icon;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => setOpen(item)}
                className="app-neon-border text-left p-4 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-primary/20 to-accent/20 text-primary border border-primary/30">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3 className="font-serif text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {item.tema}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.porque_bombou}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border/60 bg-card/60 font-medium">
                        {item.formato_sugerido}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Icon className="w-3 h-3" style={{ color: m.color }} />
                        {m.label}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

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
                  <span>Fonte: {sourceMeta(open.fonte).label}</span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
