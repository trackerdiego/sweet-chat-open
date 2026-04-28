import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PendingInvoice {
  asaas_payment_id: string;
  asaas_subscription_id: string | null;
  value: number;
  original_value: number;
  due_date: string | null;
  billing_type: 'PIX' | 'CREDIT_CARD' | 'UNDEFINED' | string;
  pix_qr_code: string | null;      // base64 PNG sem prefixo data:
  pix_copy_paste: string | null;
  payment_url: string;
  discount_applied: { coins_used: number; credits_used_brl: number; discount_brl: number };
  notifications_sent: { d3: boolean; d1: boolean; d0: boolean };
  is_paid: boolean;
  updated_at: string;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function usePendingInvoice() {
  const [invoice, setInvoice] = useState<PendingInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from as any)('subscription_state')
      .select('next_invoice')
      .eq('user_id', user.id)
      .maybeSingle();
    setInvoice((data?.next_invoice as PendingInvoice | null) ?? null);
    setLoading(false);
  }, []);

  // Aplica coins automaticamente e re-busca QR atualizado
  const applyDiscountAndFetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-pending-invoice');
      if (error) throw error;
      setInvoice((data?.invoice as PendingInvoice | null) ?? null);
    } catch (e) {
      console.error('applyDiscountAndFetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const days = daysUntil(invoice?.due_date ?? null);
  const isPix = invoice?.billing_type === 'PIX' || invoice?.billing_type === 'UNDEFINED';
  const hasUrgentInvoice = !!invoice && !invoice.is_paid && isPix && days !== null && days <= 3;

  return {
    invoice,
    loading,
    daysUntilDue: days,
    hasUrgentInvoice,
    refresh,
    applyDiscountAndFetch,
  };
}
