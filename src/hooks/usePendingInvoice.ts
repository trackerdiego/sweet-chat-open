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

/**
 * Um next_invoice é considerado obsoleto quando o period_end da assinatura
 * já foi muito além do due_date do invoice. Isso indica que a assinatura
 * foi renovada/estendida por outro caminho (liberação manual, correção via
 * SQL, ajuste de cortesia) e o invoice antigo ficou órfão no
 * subscription_state.next_invoice. Sem esse guard, a cliente vê banner
 * vermelho "Sua fatura Pix vence hoje" mesmo estando 100% em dia.
 */
function isInvoiceStale(dueDate: string | null, currentPeriodEnd: string | null): boolean {
  if (!dueDate || !currentPeriodEnd) return false;
  const due = new Date(dueDate).getTime();
  const periodEnd = new Date(currentPeriodEnd).getTime();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  return periodEnd - due > TWO_DAYS;
}

export function usePendingInvoice() {
  const [invoice, setInvoice] = useState<PendingInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from as any)('subscription_state')
      .select('next_invoice, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();
    const raw = (data?.next_invoice as PendingInvoice | null) ?? null;
    if (raw && isInvoiceStale(raw.due_date, data?.current_period_end ?? null)) {
      setInvoice(null);
    } else {
      setInvoice(raw);
    }
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
  // Pix pendente (mesmo sem urgência). Cartão recorrente NUNCA aparece.
  const hasPendingPixInvoice = !!invoice && !invoice.is_paid && isPix;
  const hasUrgentInvoice = hasPendingPixInvoice && days !== null && days <= 3;

  return {
    invoice,
    loading,
    daysUntilDue: days,
    hasPendingPixInvoice,
    hasUrgentInvoice,
    refresh,
    applyDiscountAndFetch,
  };
}

