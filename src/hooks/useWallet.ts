import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WalletState {
  coins_balance: number;
  referral_credits_brl: number;
  lifetime_coins_earned: number;
}

export interface CoinTransaction {
  id: string;
  amount: number;
  type: string;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const EMPTY_WALLET: WalletState = {
  coins_balance: 0,
  referral_credits_brl: 0,
  lifetime_coins_earned: 0,
};

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setWallet(EMPTY_WALLET);
      setLoading(false);
      return;
    }

    const [{ data: w }, { data: txs }] = await Promise.all([
      (supabase.from as any)('user_wallet').select('*').eq('user_id', user.id).maybeSingle(),
      (supabase.from as any)('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (w) {
      setWallet({
        coins_balance: w.coins_balance ?? 0,
        referral_credits_brl: Number(w.referral_credits_brl ?? 0),
        lifetime_coins_earned: w.lifetime_coins_earned ?? 0,
      });
    } else {
      setWallet(EMPTY_WALLET);
    }
    setTransactions((txs as CoinTransaction[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Atualiza saldo localmente após edge function award-task-coins.
  // Evita roundtrip extra mas mantém fonte da verdade no servidor (fetchWallet recarrega depois).
  const optimisticAdd = useCallback((amount: number) => {
    if (!amount) return;
    setWallet(prev => ({
      ...prev,
      coins_balance: prev.coins_balance + amount,
      lifetime_coins_earned: prev.lifetime_coins_earned + Math.max(amount, 0),
    }));
  }, []);

  return {
    wallet,
    transactions,
    loading,
    refreshWallet: fetchWallet,
    optimisticAdd,
  };
}
