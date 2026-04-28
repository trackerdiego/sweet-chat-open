import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReferralRow {
  id: string;
  referred_user_id: string;
  status: 'pending' | 'paid' | 'expired';
  first_payment_at: string | null;
  credit_awarded_brl: number;
  created_at: string;
  referred_name?: string | null;
}

export function useReferrals() {
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: codeRow }, { data: refRows }] = await Promise.all([
      (supabase.from as any)('referral_codes').select('code').eq('user_id', user.id).maybeSingle(),
      (supabase.from as any)('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setCode(codeRow?.code ?? null);

    // Best-effort: pega display_name dos indicados
    const ids = (refRows ?? []).map((r: any) => r.referred_user_id);
    let nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await (supabase.from as any)('user_profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
    }

    setReferrals((refRows ?? []).map((r: any) => ({
      ...r,
      credit_awarded_brl: Number(r.credit_awarded_brl ?? 0),
      referred_name: nameMap[r.referred_user_id] ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const paidCount = referrals.filter(r => r.status === 'paid').length;
  const totalEarnedBrl = referrals
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + (r.credit_awarded_brl || 0), 0);

  return { code, referrals, paidCount, totalEarnedBrl, loading, refresh: fetch };
}
