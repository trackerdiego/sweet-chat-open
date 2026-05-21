import { useEffect, useState } from 'react';
import { CheckoutModal } from '@/components/CheckoutModal';

const CHECKOUT_PLAN_KEY = 'pending_checkout_plan';

type Plan = 'monthly' | 'yearly';

/**
 * Abre automaticamente o CheckoutModal quando há um plano pendente
 * (vindo da landing via /auth?plan=...). Roda apenas uma vez por sessão.
 */
export function AutoCheckoutOpener() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(CHECKOUT_PLAN_KEY); } catch {}

    const params = new URLSearchParams(window.location.search);
    const urlPlan = params.get('openCheckout');
    const candidate = pending || urlPlan;

    if (candidate === 'monthly' || candidate === 'yearly') {
      setPlan(candidate);
      setOpen(true);
    }

    if (urlPlan) {
      params.delete('openCheckout');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const handleChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      try { sessionStorage.removeItem(CHECKOUT_PLAN_KEY); } catch {}
    }
  };

  if (!plan) return null;
  return <CheckoutModal open={open} onOpenChange={handleChange} initialPlan={plan} />;
}
