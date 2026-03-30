import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Target, Brain, Layers } from "lucide-react";

const highlights = [
  { icon: Target, title: "Estratégia Personalizada", description: "IA analisa seu nicho e cria um plano de 30 dias sob medida." },
  { icon: Brain, title: "Análise Visceral", description: "Mapeia gatilhos emocionais reais da sua audiência." },
  { icon: Layers, title: "Conteúdo Completo", description: "Scripts, hooks e storytelling prontos para cada dia." },
];

export function LandingFeatureBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="py-14 px-4 bg-background border-b border-border/50">
      <div className="container max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6">
          {highlights.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}} transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }} className="flex items-start gap-4 p-5 rounded-xl border border-border/60 bg-card hover:shadow-md transition-shadow">
              <div className="shrink-0 w-11 h-11 rounded-full bg-primary/12 flex items-center justify-center"><item.icon className="w-5 h-5 text-primary" /></div>
              <div><h3 className="font-semibold text-sm mb-1">{item.title}</h3><p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p></div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
