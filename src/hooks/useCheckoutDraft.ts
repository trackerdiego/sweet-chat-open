import { useEffect, useRef, useState } from "react";

const KEY = "checkout:v1";

export interface CheckoutDraft {
  step: "data" | "method" | "result";
  selectedPlan: "monthly" | "yearly";
  method: "PIX" | "CREDIT_CARD";
  installmentCount: number;
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  cep: string;
  address: string;
  addressNumber: string;
  complement: string;
  bairro: string;
  city: string;
  state: string;
  pix: { encodedImage: string; payload: string } | null;
}

export const emptyDraft: CheckoutDraft = {
  step: "data", selectedPlan: "yearly", method: "PIX", installmentCount: 1,
  name: "", email: "", cpfCnpj: "", phone: "", cep: "",
  address: "", addressNumber: "", complement: "", bairro: "", city: "", state: "",
  pix: null,
};

export function useCheckoutDraft(initialPlan?: "monthly" | "yearly") {
  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CheckoutDraft;
        return { ...emptyDraft, ...parsed, selectedPlan: initialPlan ?? parsed.selectedPlan };
      }
    } catch {}
    return { ...emptyDraft, selectedPlan: initialPlan ?? "yearly" };
  });

  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch {}
    }, 200);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [draft]);

  const update = <K extends keyof CheckoutDraft>(k: K, v: CheckoutDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const clear = () => {
    try { sessionStorage.removeItem(KEY); } catch {}
    setDraft({ ...emptyDraft, selectedPlan: initialPlan ?? "yearly" });
  };

  return { draft, setDraft, update, clear };
}
