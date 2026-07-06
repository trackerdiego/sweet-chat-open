import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
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
          <div className="pointer-events-auto w-full max-w-md mx-auto flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 p-1.5 shadow-[0_10px_40px_-10px_rgba(168,85,247,0.7)]">
            <button
              onClick={() => navigate("/auth")}
              className="shrink-0 px-3.5 py-2.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98] transition text-xs font-medium leading-tight text-left"
            >
              Já tenho<br />conta · Entrar
            </button>
            <button
              onClick={onClick}
              className="flex-1 flex items-center justify-between gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2.5 active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <div className="text-white font-bold text-sm leading-tight">
                  Assinar R$24,75
                </div>
                <div className="text-[10px] text-white/80 font-medium leading-tight mt-0.5">
                  plano anual · 7 dias garantia
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white shrink-0" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
