import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface Props {
  onClick: () => void;
}

/**
 * Sticky CTA that appears after the user scrolls past the hero (~800px).
 * Persists across the whole landing so the visitor never has to scroll
 * 15 folds to find a way to convert. Hides once the pricing block is in view
 * (would be redundant there).
 */
export function StickyCheckoutBar({ onClick }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const planos = document.getElementById("planos");
      const planosVisible = planos
        ? planos.getBoundingClientRect().top < window.innerHeight - 100
        : false;
      setVisible(window.scrollY > 800 && !planosVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 pointer-events-none"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onClick}
            className="pointer-events-auto w-full max-w-md mx-auto flex items-center justify-between gap-3 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-3.5 shadow-[0_10px_40px_-10px_rgba(168,85,247,0.7)] active:scale-[0.98] transition-transform"
          >
            <div className="text-left">
              <div className="text-white font-bold text-sm leading-tight">
                Comece agora por R$24,75
              </div>
              <div className="text-[11px] text-white/80 font-medium leading-tight mt-0.5">
                no plano anual · 7 dias garantia
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
              <span className="text-white font-semibold text-xs">Assinar</span>
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </div>

          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
