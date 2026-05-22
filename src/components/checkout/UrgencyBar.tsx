import { useEffect, useState } from "react";
import { Flame, Zap } from "lucide-react";

// Countdown reinicia a cada 48h baseado em timestamp local persistido
const KEY = "checkout:deadline";
const WINDOW_MS = 48 * 60 * 60 * 1000;

function getDeadline() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (ts > Date.now()) return ts;
    }
  } catch {}
  const next = Date.now() + WINDOW_MS;
  try { localStorage.setItem(KEY, String(next)); } catch {}
  return next;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export function UrgencyBar() {
  const [deadline] = useState(getDeadline);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const left = deadline - now;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
        <Zap size={14} className="text-primary shrink-0" />
        <span className="flex-1 text-foreground/90">Oferta de lançamento — preço sobe em</span>
        <span className="font-mono font-bold text-primary tabular-nums">{fmt(left)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Flame size={12} className="text-accent" />
        <span>+127 criadores assinaram nas últimas 24h</span>
      </div>
    </div>
  );
}
