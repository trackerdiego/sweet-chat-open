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

function NicheCard({ id, label }: { id: string; label: string }) {
  return (
    <div className="relative shrink-0 w-36 h-36 sm:w-48 sm:h-48 rounded-2xl neon-card overflow-hidden group transition-transform duration-300 hover:scale-[1.03] hover:ring-1 hover:ring-primary/60">
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <NicheIcon
          id={id}
          size={160}
          className="w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.35)]"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-2 right-2">
        <span className="inline-block px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight">
          {label}
        </span>
      </div>
    </div>
  );
}

function Row({ reverse = false }: { reverse?: boolean }) {
  const items = [...niches, ...niches];
  return (
    <div className="marquee-mask overflow-hidden">
      <div
        className={`flex gap-4 sm:gap-5 w-max ${reverse ? "animate-marquee-x-reverse" : "animate-marquee-x"} [animation-duration:55s]`}
      >
        {items.map((n, i) => (
          <NicheCard key={`${n.id}-${i}`} id={n.id} label={n.label} />
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
        <h2
          className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight"
          style={{ textWrap: "balance" }}
        >
          Funciona para <span className="neon-text">qualquer nicho</span>
        </h2>
      </div>
      <div className="space-y-4 sm:space-y-5">
        <Row />
        <Row reverse />
      </div>
    </section>
  );
}
