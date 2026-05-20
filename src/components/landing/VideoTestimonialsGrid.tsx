import { VideoTestimonialCard, type VideoTestimonial } from "./VideoTestimonialCard";

// TODO: trocar pelos IDs reais (Wistia hashed_id ou YouTube video ID).
const videoTestimonials: VideoTestimonial[] = [
  {
    provider: "youtube",
    videoId: "dQw4w9WgXcQ",
    name: "Camila R.",
    handle: "@camila.fit",
    niche: "Fitness",
    metric: "800 → 12k seguidores em 60 dias",
    quote: "Em 2 semanas meu engajamento triplicou.",
  },
  {
    provider: "youtube",
    videoId: "dQw4w9WgXcQ",
    name: "Juliana M.",
    handle: "@ju.beauty",
    niche: "Beleza",
    metric: "47 → 1.2k likes por post",
    quote: "Os scripts parecem ler a mente da audiência.",
  },
  {
    provider: "youtube",
    videoId: "dQw4w9WgXcQ",
    name: "Fernanda S.",
    handle: "@fer.lifestyle",
    niche: "Lifestyle",
    metric: "30 dias prontos em 5 minutos",
    quote: "Antes eu levava horas planejando. Agora é instantâneo.",
  },
];

export function VideoTestimonialsGrid() {
  return (
    <section className="py-20 px-4 bg-charcoal">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/15 rounded-full px-3 py-1 mb-4 border border-primary/20">
            Depoimentos reais
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3" style={{ textWrap: "balance" }}>
            Veja com seus próprios olhos
          </h2>
          <p className="text-white/50 max-w-lg mx-auto">
            Criadores reais contando como o Vyral Lab transformou o conteúdo deles.
          </p>
        </div>

        {/* Mobile: scroll horizontal com snap. Desktop: grid */}
        <div className="md:grid md:grid-cols-3 md:gap-6 flex md:flex-none gap-4 overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          {videoTestimonials.map((t, i) => (
            <div
              key={i}
              className="snap-center shrink-0 w-[78%] sm:w-[60%] md:w-auto"
            >
              <VideoTestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
