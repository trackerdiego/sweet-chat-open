import { Check, X, Minus } from "lucide-react";

type Cell = "yes" | "partial" | "no" | string;

const rows: { feature: string; influlab: Cell; chatgpt: Cell; sozinho: Cell }[] = [
  { feature: "Estratégia personalizada por nicho", influlab: "yes", chatgpt: "partial", sozinho: "no" },
  { feature: "Scripts prontos pra usar", influlab: "yes", chatgpt: "partial", sozinho: "no" },
  { feature: "Análise visceral da audiência", influlab: "yes", chatgpt: "no", sozinho: "no" },
  { feature: "Guia diário automático", influlab: "yes", chatgpt: "no", sozinho: "no" },
  { feature: "Tempo de setup", influlab: "5 min", chatgpt: "Horas", sozinho: "Semanas" },
  { feature: "Custo mensal", influlab: "R$47/mês ou R$24,75 no anual", chatgpt: "R$120+", sozinho: "Seu tempo" },
  { feature: "Suporte humano", influlab: "yes", chatgpt: "no", sozinho: "no" },
];

function CellRender({ value }: { value: Cell }) {
  if (value === "yes") return <Check className="h-5 w-5 text-primary mx-auto" />;
  if (value === "no") return <X className="h-5 w-5 text-white/30 mx-auto" />;
  if (value === "partial") return <Minus className="h-5 w-5 text-yellow-500/70 mx-auto" />;
  return <span className="text-sm text-white/80">{value}</span>;
}

export function ComparisonTable() {
  return (
    <section className="py-20 px-4 bg-charcoal">
      <div className="container max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-3 text-white" style={{ textWrap: "balance" }}>
          Por que Vyral Lab e não outra coisa?
        </h2>
        <p className="text-white/50 text-center mb-10 max-w-lg mx-auto">
          Comparado às alternativas, a diferença fica clara.
        </p>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="grid grid-cols-4 text-center text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/60 border-b border-white/10 bg-white/5">
            <div className="p-3 text-left">Recurso</div>
            <div className="p-3 text-primary">Vyral Lab</div>
            <div className="p-3">ChatGPT</div>
            <div className="p-3">Sozinho</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.feature}
              className={`grid grid-cols-4 items-center text-center text-xs sm:text-sm ${
                i % 2 === 0 ? "bg-transparent" : "bg-white/5"
              }`}
            >
              <div className="p-3 sm:p-4 text-left text-white/80">{r.feature}</div>
              <div className="p-3 sm:p-4"><CellRender value={r.influlab} /></div>
              <div className="p-3 sm:p-4"><CellRender value={r.chatgpt} /></div>
              <div className="p-3 sm:p-4"><CellRender value={r.sozinho} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
