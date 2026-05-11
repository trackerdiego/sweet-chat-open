const stats = [
  { value: "+1.200", label: "Criadores ativos" },
  { value: "+15k", label: "Scripts gerados" },
  { value: "23", label: "Nichos cobertos" },
  { value: "4.9/5", label: "Avaliação média" },
];

export function StatsBar() {
  return (
    <section className="bg-charcoal border-y border-white/10">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-[10px] md:text-xs uppercase tracking-widest text-white/50">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
