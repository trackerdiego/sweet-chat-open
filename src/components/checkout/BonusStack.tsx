import { Check } from "lucide-react";

const items = [
  { label: "Acesso completo Influ Lab", value: "R$ 297", free: false },
  { label: "Bônus: Matriz 30 dias custom", value: "R$ 197", free: true },
  { label: "Bônus: Banco de hooks virais", value: "R$ 97", free: true },
  { label: "Bônus: IA de roteiros ilimitada", value: "R$ 147", free: true },
];

export function BonusStack({ price }: { price: number }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
        O que você leva hoje
      </p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-foreground/90">
              <Check size={14} className="text-primary shrink-0" />
              {it.label}
            </span>
            {it.free ? (
              <span className="text-[10px] font-bold gold-gradient text-primary-foreground px-2 py-0.5 rounded-full">
                GRÁTIS
              </span>
            ) : (
              <span className="text-xs text-muted-foreground line-through">{it.value}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
        <div className="text-xs text-muted-foreground">
          Valor total: <span className="line-through">R$ 738</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Você paga</div>
          <div className="text-lg font-bold text-primary">R$ {price}</div>
        </div>
      </div>
    </div>
  );
}
