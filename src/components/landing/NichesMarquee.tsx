import { NicheIcon } from "@/components/NicheIcon";

const niches = [
  { id: "fitness", label: "Fitness" },
  { id: "beleza", label: "Beleza" },
  { id: "moda", label: "Moda" },
  { id: "culinaria", label: "Culinária" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "viagem", label: "Viagem" },
  { id: "pets", label: "Pets" },
  { id: "educacao", label: "Educação" },
  { id: "negocios", label: "Negócios" },
  { id: "saude-mental", label: "Saúde mental" },
  { id: "vida-real", label: "Vida real" },
];

function Row({ reverse = false }: { reverse?: boolean }) {
  const items = [...niches, ...niches]; // duplicate for seamless loop
  return (
    <div className="marquee-mask overflow-hidden">
      <div className={`flex gap-3 w-max ${reverse ? "animate-marquee-x-reverse" : "animate-marquee-x"}`}>
        {items.map((n, i) => (
          <div
            key={`${n.id}-${i}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full neon-card whitespace-nowrap"
          >
            <NicheIcon id={n.id} size={18} />
            <span className="text-sm text-white/85 font-medium">{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NichesMarquee() {
  return (
    <section className="py-16 px-4 relative overflow-hidden">
      <div className="container max-w-6xl mx-auto text-center mb-8">
        <span className="neon-chip mb-4">Variedade</span>
        <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight"
            style={{ textWrap: "balance" }}>
          Funciona para <span className="neon-text">qualquer nicho</span>
        </h2>
      </div>
      <div className="space-y-3">
        <Row />
        <Row reverse />
      </div>
    </section>
  );
}
