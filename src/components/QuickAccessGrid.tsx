// QuickAccessGrid — atalhos visuais para as áreas principais do app.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CheckSquare, Wrench, Gift, ArrowUpRight, type LucideIcon } from 'lucide-react';

type Item = {
  to: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  tint: string; // hsl color hue/sat/lightness
};

const items: Item[] = [
  { to: '/matriz',      title: 'Matriz',     subtitle: 'Plano de 30 dias',   Icon: CalendarDays, tint: '270 95% 65%' },
  { to: '/tarefas',     title: 'Tarefas',    subtitle: 'Checklist do dia',   Icon: CheckSquare,  tint: '322 90% 60%' },
  { to: '/ferramentas', title: 'Ferramentas',subtitle: 'Hooks, CTAs, ideias',Icon: Wrench,       tint: '210 95% 60%' },
  { to: '/indique',     title: 'Indique',    subtitle: 'Ganhe coins',        Icon: Gift,         tint: '38 95% 60%' },
];

export function QuickAccessGrid() {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="font-serif text-xl font-semibold">Acesso rápido</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it, i) => {
          const Icon = it.Icon;
          return (
            <motion.div
              key={it.to}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to={it.to}
                className="app-neon-border soft block p-4 h-28 relative group hover:-translate-y-0.5 transition-transform"
                style={{ background: `linear-gradient(135deg, hsl(${it.tint} / 0.10), hsl(var(--card) / 0.5))` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                  style={{
                    background: `linear-gradient(135deg, hsl(${it.tint} / 0.25), hsl(${it.tint} / 0.10))`,
                    border: `1px solid hsl(${it.tint} / 0.35)`,
                    boxShadow: `0 0 18px -6px hsl(${it.tint} / 0.5)`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: `hsl(${it.tint})` }} />
                </div>
                <div className="space-y-0.5">
                  <p className="font-serif text-base font-semibold text-foreground leading-tight">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{it.subtitle}</p>
                </div>
                <ArrowUpRight
                  size={16}
                  className="absolute top-3 right-3 text-muted-foreground group-hover:text-foreground transition-colors"
                />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
