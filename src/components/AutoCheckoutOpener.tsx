import { useEffect, useState } from 'react';
import { CheckoutModal } from '@/components/CheckoutModal';
import { useSubscription } from '@/hooks/useSubscription';
import { CHECKOUT_PLAN_KEY, clearPendingCheckout } from '@/lib/checkoutStorage';
import { logDiagnostic } from '@/lib/diagnostics';

type Plan = 'monthly' | 'yearly';

/**
 * Abre automaticamente o CheckoutModal quando há um plano pendente
 * (vindo da landing via /auth?plan=...). Roda apenas uma vez por sessão.
 */
export function AutoCheckoutOpener() {
  const sub = useSubscription();
  const { isActive, loading, hasLoadedOnce } = sub;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !hasLoadedOnce) return;

    if (isActive) {
      clearPendingCheckout();
      setOpen(false);
      setPlan(null);
      return;
    }

    let pending: string | null = null;
    try { pending = sessionStorage.getItem(CHECKOUT_PLAN_KEY); } catch {}

    const params = new URLSearchParams(window.location.search);
    const urlPlan = params.get('openCheckout');
    const candidate = pending || urlPlan;

    if (candidate === 'monthly' || candidate === 'yearly') {
      setPlan(candidate);
      setOpen(true);
      logDiagnostic('auto_opener_fired', 'AutoCheckoutOpener', {
        candidatePlan: candidate,
        fromSessionStorage: !!pending,
        fromUrlParam: !!urlPlan,
        subscription: {
          status: sub.status,
          plan: sub.plan,
          current_period_end: sub.currentPeriodEnd,
          trial_ends_at: sub.trialEndsAt,
          asaas_customer_id: sub.asaasCustomerId,
        },
        hasAccess: sub.hasAccess,
        isActive: sub.isActive,
      });
    }

    if (urlPlan) {
      params.delete('openCheckout');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [hasLoadedOnce, isActive, loading]);

  const handleChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      clearPendingCheckout();
    }
  };

  if (!plan) return null;
  return <CheckoutModal open={open} onOpenChange={handleChange} initialPlan={plan} />;
}
