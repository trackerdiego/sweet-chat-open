import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Brain, FileText, Calendar, Wrench, Trophy, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: Sparkles, label: "Onboarding", color: "text-amber-400", ring: "ring-amber-400", glow: "shadow-[0_0_28px_rgba(251,191,36,0.55)]", bg: "bg-amber-400/15" },
  { icon: Brain, label: "Análise Visceral", color: "text-fuchsia-400", ring: "ring-fuchsia-400", glow: "shadow-[0_0_28px_rgba(232,121,249,0.55)]", bg: "bg-fuchsia-400/15" },
  { icon: FileText, label: "Matriz 30 dias", color: "text-violet-300", ring: "ring-violet-300", glow: "shadow-[0_0_28px_rgba(196,181,253,0.6)]", bg: "bg-violet-300/15" },
  { icon: Calendar, label: "Guia diário", color: "text-sky-400", ring: "ring-sky-400", glow: "shadow-[0_0_28px_rgba(56,189,248,0.55)]", bg: "bg-sky-400/15" },
  { icon: Wrench, label: "Ferramentas IA", color: "text-emerald-400", ring: "ring-emerald-400", glow: "shadow-[0_0_28px_rgba(52,211,153,0.55)]", bg: "bg-emerald-400/15" },
  { icon: Trophy, label: "Crescimento", color: "text-pink-400", ring: "ring-pink-400", glow: "shadow-[0_0_28px_rgba(244,114,182,0.55)]", bg: "bg-pink-400/15" },
];

const STEP_MS = 1700;

export function RealtimeTracker() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setActiveIndex(2); return; }
    const id = setInterval(() => {
      setActiveIndex((i) => (i >= steps.length - 1 ? 0 : i + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

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

        <div className="neon-card p-4 sm:p-8">
          <div className="flex items-start w-full">
            {steps.map((s, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-start flex-1 min-w-0 last:flex-none">
                  {/* step */}
                  <div className="flex flex-col items-center gap-2 sm:gap-3 shrink-0 w-12 sm:w-20">
                    <div className="relative">
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                        className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${s.bg} transition-all duration-500 ${
                          isActive
                            ? `ring-2 ${s.ring} ${s.glow}`
                            : isPast
                              ? `ring-2 ${s.ring}/70`
                              : "opacity-45"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            className={`absolute inset-0 rounded-full ring-2 ${s.ring}`}
                            initial={{ opacity: 0.7, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.8 }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                          />
                        )}
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${s.color}`} />
                      </motion.div>
                      <AnimatePresence>
                        {isPast && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 16 }}
                            className="absolute -top-1 -right-1 bg-emerald-500 rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center ring-2 ring-background"
                          >
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className={`text-[9px] sm:text-[11px] leading-tight text-center font-medium transition-colors duration-300 break-words ${
                      isActive ? "text-white font-semibold" : isPast ? "text-white/70" : "text-white/40"
                    }`}>
                      {s.label}
                    </span>
                  </div>

                  {/* connector */}
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mt-5 sm:mt-7 mx-1 sm:mx-2 rounded-full bg-white/10 overflow-hidden min-w-[8px]">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary via-fuchsia-400 to-accent"
                        initial={false}
                        animate={{ width: isPast ? "100%" : isActive ? "100%" : "0%" }}
                        transition={{
                          duration: isActive ? STEP_MS / 1000 : 0.45,
                          ease: isActive ? "linear" : "easeOut",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 sm:mt-8 text-center border-t border-white/10 pt-4">
            <span className="text-xs sm:text-sm text-white/60">Status atual: </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-xs sm:text-sm font-semibold neon-text inline-block"
              >
                {steps[activeIndex].label}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
