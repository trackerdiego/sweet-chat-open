import { VideoEmbed } from "./VideoEmbed";

export function ProductDemoVideo() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/15 rounded-full px-3 py-1 mb-4 border border-primary/20">
            Demo em 90 segundos
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3" style={{ textWrap: "balance" }}>
            Veja o Vyral Lab em ação
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Da pergunta ao roteiro pronto — entenda como a IA monta sua estratégia.
          </p>
        </div>

        {/* TODO: trocar videoId pelo real */}
        <VideoEmbed provider="youtube" videoId="dQw4w9WgXcQ" title="Demo Vyral Lab" aspect="16/9" />
      </div>
    </section>
  );
}
