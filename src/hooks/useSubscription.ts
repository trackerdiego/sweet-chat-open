import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SubStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface SubscriptionState {
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  plan: 'monthly' | 'annual' | null;
  firstPaidAt: string | null;
  asaasCustomerId: string | null;
}

const DEFAULT: SubscriptionState = {
  status: 'trial',
  trialEndsAt: null,
  currentPeriodEnd: null,
  plan: null,
  firstPaidAt: null,
  asaasCustomerId: null,
};

const ADMIN_EMAIL = 'agentevendeagente@gmail.com';

const ADMIN_SUB: SubscriptionState = {
  status: 'active',
  trialEndsAt: null,
  currentPeriodEnd: null,
  plan: null,
  firstPaidAt: null,
  asaasCustomerId: null,
};

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionState>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Admin bypass — nunca trava o admin master no paywall, mesmo
    // se a query do subscription_state falhar por lock contention.
    if (user.email === ADMIN_EMAIL) {
      setIsAdmin(true);
      setSub(ADMIN_SUB);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    // Retry curto: protege contra lock "stolen" do supabase-js
    // que pode retornar { data: null, error: ... } na primeira tentativa.
    let attempt = 0;
    let lastErr: any = null;
    while (attempt < 2) {
      const { data, error } = await (supabase.from as any)('subscription_state')
        .select('status, trial_ends_at, current_period_end, plan, first_paid_at, asaas_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error) {
        if (data) {
          setSub({
            status: data.status,
            trialEndsAt: data.trial_ends_at,
            currentPeriodEnd: data.current_period_end,
            plan: data.plan,
            firstPaidAt: data.first_paid_at ?? null,
            asaasCustomerId: data.asaas_customer_id ?? null,
          });
        }
        // Sucesso (com ou sem linha) — temos certeza do estado real.
        setHasLoadedOnce(true);
        setLoading(false);
        return;
      }

      lastErr = error;
      attempt++;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500));
    }

    // Query falhou nas 2 tentativas. NÃO marcamos hasLoadedOnce
    // pra evitar flash de paywall em premium real. Mantém loading=false
    // pra não travar a UI pra sempre, mas App.tsx usa hasLoadedOnce
    // como guard antes de mostrar paywall.
    if (import.meta.env.DEV) console.warn('[useSubscription] fetch falhou:', lastErr);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const now = Date.now();
  const trialEndMs = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0;
  const isTrialing = false;
  const isActive = sub.status === 'active';
  const isExpired = sub.status === 'trial' && trialEndMs <= now;
  const isPastDueOrCanceled = sub.status === 'past_due' || sub.status === 'canceled';
  const hasAccess = isActive;
  const daysLeftInTrial = 0;

  return {
    ...sub,
    loading,
    hasLoadedOnce,
    isAdmin,
    isTrialing,
    isActive,
    isExpired,
    isPastDueOrCanceled,
    hasAccess,
    daysLeftInTrial,
    refresh: fetch,
  };
}
