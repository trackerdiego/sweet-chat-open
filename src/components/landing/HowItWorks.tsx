import { motion } from "framer-motion";
import { UserPlus, Sparkles, Rocket } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "1. Conte sobre você",
    description:
      "Em 2 minutos, a IA aprende seu nicho, audiência e estilo no onboarding.",
  },
  {
    icon: Sparkles,
    title: "2. IA gera sua matriz",
    description:
      "Receba 30 dias de estratégia com scripts, hooks e CTAs prontos pra usar.",
  },
  {
    icon: Rocket,
    title: "3. Poste e cresça",
    description:
      "Siga o guia diário, acompanhe o progresso e veja seu engajamento decolar.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container max-w-5xl mx-auto">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-3" style={{ textWrap: "balance" }}>
          Do zero à estratégia em <span className="text-primary">5 minutos</span>
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">
          Sem curva de aprendizado. Sem complicação.
        </p>
        <div className="grid md:grid-cols-3 gap-6 relative">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative bg-card border border-border/60 rounded-2xl p-6 text-center"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                <s.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
