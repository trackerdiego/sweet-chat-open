import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink, CreditCard, Loader2, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePendingInvoice } from '@/hooks/usePendingInvoice';
import { useSubscription } from '@/hooks/useSubscription';

function brl(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }

export default function Renew() {
  const { invoice, loading, daysUntilDue, applyDiscountAndFetch, refresh } = usePendingInvoice();
  const { refresh: refreshSub, isActive } = useSubscription();
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const didApply = useRef(false);

  // Aplica coins automaticamente na primeira carga
  useEffect(() => {
    if (didApply.current) return;
    didApply.current = true;
    applyDiscountAndFetch();
  }, [applyDiscountAndFetch]);

  // Polling a cada 10s pra detectar pagamento
  useEffect(() => {
    const id = setInterval(async () => {
      await refreshSub();
      await refresh();
    }, 10000);
    return () => clearInterval(id);
  }, [refresh, refreshSub]);

  // Se virou ativo, redireciona pro app
  useEffect(() => {
    if (isActive) {
      toast({ title: 'Pagamento confirmado!', description: 'Bem-vindo de volta.' });
      navigate('/');
    }
  }, [isActive, navigate, toast]);

  const handleCopy = async () => {
    if (!invoice?.pix_copy_paste) return;
    await navigator.clipboard.writeText(invoice.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Código Pix copiado!' });
  };

  const handleSwitchToCard = async () => {
    setSwitching(true);
    try {
      const { data, error } = await supabase.functions.invoke('switch-to-credit-card');
      if (error) throw error;
      if (data?.checkoutUrl) window.open(data.checkoutUrl, '_blank');
      await refresh();
    } catch (e: any) {
      toast({ title: 'Erro ao trocar para cartão', description: e.message, variant: 'destructive' });
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 pb-24">
        <div className="glass-card max-w-md w-full p-7 text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold">Nenhuma fatura pendente</h1>
          <p className="text-sm text-muted-foreground">Sua assinatura está em dia.</p>
          <Button onClick={() => navigate('/')} className="w-full">Voltar pro app</Button>
        </div>
      </div>
    );
  }

  const discount = invoice.discount_applied?.discount_brl ?? 0;
  const hasDiscount = discount > 0;
  const isCard = invoice.billing_type === 'CREDIT_CARD';
  const dueLabel =
    daysUntilDue === null ? '' :
    daysUntilDue < 0 ? `Venceu há ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'dia' : 'dias'}` :
    daysUntilDue === 0 ? 'Vence hoje' :
    daysUntilDue === 1 ? 'Vence amanhã' :
    `Vence em ${daysUntilDue} dias`;

  return (
    <div className="min-h-[100dvh] flex items-start md:items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-24 md:pb-10">
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="glass-card max-w-md w-full p-6 space-y-5"
      >
        <div className="text-center space-y-1">
          <h1 className="font-serif text-2xl font-bold text-foreground">Renove sua assinatura</h1>
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} /> {dueLabel}
          </div>
        </div>

        {isActive && (daysUntilDue ?? 0) > 3 && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5 text-xs text-muted-foreground text-center">
            Sua assinatura está ativa. Você pode adiantar o próximo pagamento abaixo.
          </div>
        )}

        {hasDiscount && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
            <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Você economizou {brl(discount)} com suas coins!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="line-through">{brl(invoice.original_value)}</span>
                {' → '}
                <span className="font-bold text-primary">{brl(invoice.value)}</span>
              </p>
            </div>
          </div>
        )}

        {isCard ? (
          <div className="bg-muted/50 rounded-xl p-5 text-center space-y-3">
            <CreditCard size={32} className="mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Sua fatura foi convertida para cartão. Clique abaixo para finalizar o pagamento na página segura do Asaas.
            </p>
          </div>
        ) : invoice.pix_qr_code ? (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 flex items-center justify-center">
              <img
                src={`data:image/png;base64,${invoice.pix_qr_code}`}
                alt="QR Code Pix"
                className="w-56 h-56 object-contain"
              />
            </div>
            {invoice.pix_copy_paste && (
              <Button
                variant="outline"
                onClick={handleCopy}
                className="w-full gap-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Código copiado!' : 'Copiar código Pix'}
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-xl p-5 text-center text-sm text-muted-foreground">
            QR Code não disponível. Use o botão abaixo para abrir a fatura no Asaas.
          </div>
        )}

        <div className="text-center text-2xl font-bold text-foreground">
          Total: {brl(invoice.value)}
        </div>

        <Button
          onClick={() => window.open(invoice.payment_url, '_blank')}
          className="w-full gold-gradient text-primary-foreground gap-2 h-11"
        >
          {isCard ? 'Pagar no cartão' : 'Abrir no banco'} <ExternalLink size={16} />
        </Button>

        {!isCard && (
          <Button
            variant="outline"
            onClick={handleSwitchToCard}
            disabled={switching}
            className="w-full gap-2"
          >
            {switching ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Prefere pagar no cartão? Trocar agora
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Aguardando confirmação automática do pagamento. Você será redirecionado assim que cair.
        </p>
      </motion.div>
    </div>
  );
}
