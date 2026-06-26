import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

const NAMES = [
  "Juliana", "Camila", "Mariana", "Bianca", "Larissa", "Beatriz", "Amanda",
  "Carolina", "Letícia", "Gabriela", "Isabela", "Fernanda", "Patrícia",
  "Vanessa", "Renata", "Aline", "Priscila", "Tatiana", "Rafaela", "Bruna",
  "Daniela", "Natália", "Sabrina", "Karina", "Vitória", "Luana", "Jéssica",
  "Thaís", "Roberta", "Andressa", "Carla", "Débora", "Eduarda", "Helena",
  "Ingrid", "Júlia", "Kelly", "Marcela", "Nathália", "Paula",
];

const CITIES = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre",
  "Salvador", "Fortaleza", "Recife", "Brasília", "Goiânia", "Manaus", "Belém",
  "Florianópolis", "Campinas", "Ribeirão Preto", "Vitória", "Natal",
  "João Pessoa", "Maceió", "Aracaju", "São Luís", "Cuiabá", "Campo Grande",
  "Uberlândia", "Sorocaba",
];

type Plan = "Plano Anual" | "Plano Mensal";
type Method = "PIX" | "Cartão" | "Cartão em 12x";

interface Notif {
  id: number;
  name: string;
  city: string;
  plan: Plan;
  method: Method;
  ago: string;
  initial: string;
  hue: number;
}

const pickWeighted = <T,>(items: { v: T; w: number }[]): T => {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const i of items) {
    if ((r -= i.w) <= 0) return i.v;
  }
  return items[0].v;
};

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

let lastName = "";

const buildNotif = (): Notif => {
  let name = NAMES[rand(0, NAMES.length - 1)];
  while (name === lastName) name = NAMES[rand(0, NAMES.length - 1)];
  lastName = name;

  const plan = pickWeighted<Plan>([
    { v: "Plano Anual", w: 70 },
    { v: "Plano Mensal", w: 30 },
  ]);

  const methodPool: { v: Method; w: number }[] =
    plan === "Plano Anual"
      ? [
          { v: "PIX", w: 55 },
          { v: "Cartão", w: 30 },
          { v: "Cartão em 12x", w: 15 },
        ]
      : [
          { v: "PIX", w: 65 },
          { v: "Cartão", w: 35 },
        ];

  const method = pickWeighted(methodPool);

  const useHours = Math.random() < 0.2;
  const ago = useHours
    ? `há ${rand(1, 4)} ${rand(1, 4) === 1 ? "hora" : "horas"}`
    : `há ${rand(1, 58)} minutos`;

  return {
    id: Date.now() + Math.random(),
    name,
    city: CITIES[rand(0, CITIES.length - 1)],
    plan,
    method,
    ago,
    initial: name.charAt(0),
    hue: rand(250, 320),
  };
};

export function SalesNotifications() {
  const [current, setCurrent] = useState<Notif | null>(null);
  const pausedUntil = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delayMs: number) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (document.hidden || Date.now() < pausedUntil.current) {
          schedule(5000);
          return;
        }
        const n = buildNotif();
        setCurrent(n);
        // hide after 5s
        window.setTimeout(() => {
          if (cancelled) return;
          setCurrent((c) => (c?.id === n.id ? null : c));
          schedule(rand(18000, 35000));
        }, 5000);
      }, delayMs);
    };

    // first appearance after 15s
    schedule(15000);

    const onVis = () => {
      if (!document.hidden) schedule(2000);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const dismiss = () => {
    setCurrent(null);
    pausedUntil.current = Date.now() + 2 * 60 * 1000;
  };

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed z-[55] pointer-events-none
                 top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3
                 sm:top-auto sm:right-auto sm:bottom-4 sm:left-4 sm:max-w-[320px]"
    >
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: -24, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="pointer-events-auto mx-auto sm:mx-0 max-w-[340px] flex items-start gap-3
                       rounded-2xl border border-primary/25 bg-card/95 backdrop-blur-md
                       p-3 pr-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]"
          >
            <div
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm relative"
              style={{
                background: `linear-gradient(135deg, hsl(${current.hue} 80% 55%), hsl(${current.hue + 30} 75% 50%))`,
              }}
            >
              {current.initial}
              <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-emerald-400 bg-card rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                {current.name}, de {current.city}
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                acabou de assinar o{" "}
                <span className="text-foreground font-medium">{current.plan}</span>{" "}
                no <span className="text-foreground font-medium">{current.method}</span>
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {current.ago} · pagamento confirmado
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Fechar notificação"
              className="shrink-0 -mt-1 -mr-0.5 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
