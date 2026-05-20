import { motion } from "framer-motion";
import { Sparkles, Brain, FileText, Calendar, Wrench, Trophy } from "lucide-react";

const steps = [
  { icon: Sparkles, label: "Onboarding", color: "text-amber-400", ring: "ring-amber-400/40", bg: "bg-amber-400/15" },
  { icon: Brain, label: "Análise Visceral", color: "text-fuchsia-400", ring: "ring-fuchsia-400/40", bg: "bg-fuchsia-400/15" },
  { icon: FileText, label: "Matriz 30 dias", color: "text-violet-300", ring: "ring-violet-300/40", bg: "bg-violet-300/15" },
  { icon: Calendar, label: "Guia diário", color: "text-sky-400", ring: "ring-sky-400/40", bg: "bg-sky-400/15" },
  { icon: Wrench, label: "Ferramentas IA", color: "text-emerald-400", ring: "ring-emerald-400/40", bg: "bg-emerald-400/15" },
  { icon: Trophy, label: "Crescimento", color: "text-pink-400", ring: "ring-pink-400/40", bg: "bg-pink-400/15" },
];

const activeIndex = 2; // "Matriz 30 dias" — pulsing neon

export function RealtimeTracker() {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="neon-orb w-[420px] h-[420px] -top-32 left-1/2 -translate-x-1/2 bg-primary/20" />
      <div className="container max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <span className="neon-chip mb-4">Em tempo real</span>
          <h2 className="font-sans font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-3"
              style={{ textWrap: "balance" }}>
            Acompanhe sua <span className="neon-text">jornada</span> dia a dia
          </h2>
          <p className="text-white/55 max-w-xl mx-auto">
            Da configuração ao crescimento — você sabe exatamente onde está na sua estratégia.
          </p>
        </div>

        <div className="neon-card p-6 sm:p-10">
          <div className="flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto pb-2">
            {steps.map((s, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center shrink-0">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex flex-col items-center gap-3 w-20 sm:w-28"
                  >
                    <div
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ${s.bg} ${
                        isActive ? "step-pulse animate-pulse-neon" : isPast ? "ring-2 " + s.ring : "opacity-50"
                      }`}
                    >
                      <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${s.color}`} />
                    </div>
                    <span className={`text-[11px] sm:text-xs text-center font-medium ${isActive ? "text-white" : "text-white/55"}`}>
                      {s.label}
                    </span>
                  </motion.div>
                  {i < steps.length - 1 && (
                    <div className="w-6 sm:w-12 h-0.5 mx-1 sm:mx-2 rounded-full overflow-hidden bg-white/10">
                      <div
                        className={`h-full transition-all duration-700 ${
                          i < activeIndex ? "w-full bg-gradient-to-r from-primary to-accent" : "w-0"
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <span className="text-sm text-white/60">Status atual: </span>
            <span className="text-sm font-semibold neon-text">Matriz de 30 dias pronta</span>
          </div>
        </div>
      </div>
    </section>
  );
}
