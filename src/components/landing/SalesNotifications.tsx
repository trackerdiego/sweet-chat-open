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
      className="fixed z-[55] pointer-events-none left-0 right-0 flex justify-center sm:justify-start sm:left-4 sm:right-auto px-3 sm:px-0"
      style={{
        bottom: "calc(84px + env(safe-area-inset-bottom))",
      }}
    >
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto max-w-[300px] flex items-center gap-2.5
                       rounded-xl border border-black/5 bg-white/95 backdrop-blur-md
                       px-3 py-2 pr-1.5 shadow-lg"
          >
            <CheckCircle2 className="shrink-0 h-4 w-4 text-emerald-500" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-zinc-800 leading-snug">
                <span className="font-semibold">{current.name}</span>
                <span className="text-zinc-500"> de {current.city} </span>
                assinou o <span className="font-semibold">{current.plan}</span>
                <span className="text-zinc-500"> no {current.method}</span>
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{current.ago}</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Fechar notificação"
              className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

