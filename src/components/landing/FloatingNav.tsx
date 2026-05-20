import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoHorizontal from "@/assets/influlab-logo-horizontal.png";

const sections = [
  { id: "inicio", label: "Início" },
  { id: "como-funciona", label: "Como Funciona" },
  { id: "recursos", label: "Recursos" },
  { id: "planos", label: "Planos" },
  { id: "faq", label: "FAQ" },
];

export function FloatingNav({ onPlansClick }: { onPlansClick: () => void }) {
  const navigate = useNavigate();
  const [active, setActive] = useState("inicio");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <nav className="fixed top-3 left-0 right-0 z-50 px-2 sm:px-3 pt-[env(safe-area-inset-top)] max-w-full">
      <div className="container max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        {/* Logo */}
        <div className="nav-pill flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 shrink-0">
          <img
            src={logoHorizontal}
            alt="InfluLab"
            className="h-5 sm:h-6 w-auto brightness-0 invert"
          />
        </div>

        {/* Center pill (desktop only) */}
        <div className="nav-pill hidden lg:flex items-center px-2 py-1.5 min-w-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors text-white/70 hover:text-white whitespace-nowrap ${
                active === s.id ? "nav-pill-item-active" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="nav-pill flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1 sm:py-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/auth")}
            className="hidden xs:inline-flex text-white/80 hover:text-white hover:bg-white/10 rounded-full px-3 text-xs sm:text-sm whitespace-nowrap"
          >
            Entrar
          </Button>
          <Button
            size="sm"
            onClick={onPlansClick}
            className="neon-cta rounded-full px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
          >
            Começar
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
