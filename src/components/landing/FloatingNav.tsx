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
    <nav className="fixed top-3 left-0 right-0 z-50 px-3 pt-[env(safe-area-inset-top)]">
      <div className="container max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="nav-pill flex items-center px-3 py-2 shrink-0">
          <img src={logoHorizontal} alt="InfluLab" className="h-6 w-auto" />
        </div>

        {/* Center pill (desktop only) */}
        <div className="nav-pill hidden lg:flex items-center px-2 py-1.5">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors text-white/70 hover:text-white ${
                active === s.id ? "nav-pill-item-active" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="nav-pill flex items-center gap-2 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/auth")}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full"
          >
            Entrar
          </Button>
          <Button
            size="sm"
            onClick={onPlansClick}
            className="neon-cta rounded-full px-4"
          >
            Começar
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
