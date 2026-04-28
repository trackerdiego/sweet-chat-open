import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SubStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface SubscriptionState {
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  plan: 'monthly' | 'annual' | null;
}

const DEFAULT: SubscriptionState = {
  status: 'trial',
  trialEndsAt: null,
  currentPeriodEnd: null,
  plan: null,
};

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionState>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from as any)('subscription_state')
      .select('status, trial_ends_at, current_period_end, plan')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setSub({
        status: data.status,
        trialEndsAt: data.trial_ends_at,
        currentPeriodEnd: data.current_period_end,
        plan: data.plan,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const now = Date.now();
  const trialEndMs = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0;
  const isTrialing = sub.status === 'trial' && trialEndMs > now;
  const isActive = sub.status === 'active';
  const isExpired = sub.status === 'trial' && trialEndMs <= now;
  const isPastDueOrCanceled = sub.status === 'past_due' || sub.status === 'canceled';
  const hasAccess = isActive || isTrialing;
  const daysLeftInTrial = isTrialing
    ? Math.max(1, Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    ...sub,
    loading,
    isTrialing,
    isActive,
    isExpired,
    isPastDueOrCanceled,
    hasAccess,
    daysLeftInTrial,
    refresh: fetch,
  };
}
