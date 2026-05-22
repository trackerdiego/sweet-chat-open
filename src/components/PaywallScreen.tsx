import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, LogOut, ShieldCheck, Lock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/CheckoutModal';
import { useUserProfile } from '@/hooks/useUserProfile';

const CHECKOUT_PLAN_KEY = 'pending_checkout_plan';

/**
 * Tela de retenção mostrada após signup (e ao fechar o modal do PIX).
 * Visual alinhado ao novo CheckoutModal: header lilás + gatilhos de
 * segurança (garantia + prova social), sem repetir os bullets de feature
 * que já aparecem no BonusStack dentro do modal.
 */
export function PaywallScreen() {
  const { signOut } = useUserProfile();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState<'monthly' | 'yearly' | undefined>(undefined);

  useEffect(() => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(CHECKOUT_PLAN_KEY); } catch {}
    const params = new URLSearchParams(window.location.search);
    const urlPlan = params.get('openCheckout');
    const candidate = pending || urlPlan;
    if (candidate === 'monthly' || candidate === 'yearly') {
      setInitialPlan(candidate);
      setCheckoutOpen(true);
    } else {
      setCheckoutOpen(true);
    }
  }, []);

  return (
    <>
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full rounded-2xl overflow-hidden border border-border/40 bg-card shadow-xl"
        >
          {/* Header lilás — mesma assinatura do CheckoutModal */}
          <div className="gradient-header relative px-6 py-7 text-center overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30 flex items-center justify-center mb-3">
                <Crown size={26} className="text-white" />
              </div>
              <h1 className="font-display font-bold text-2xl text-white">
                Falta só o último passo
              </h1>
              <p className="text-sm text-white/85 mt-1.5">
                Finalize sua assinatura para liberar a IA.
              </p>
            </div>
          </div>

          {/* Corpo — gatilhos de retenção (sem repetir features do BonusStack) */}
          <div className="p-6 space-y-4">
            {/* Garantia 7 dias */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">7 dias de garantia</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se não amar, devolvemos 100%. Sem perguntas.
                </p>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={() => setCheckoutOpen(true)}
              className="w-full gold-gradient text-primary-foreground gap-2 h-12 text-base font-semibold"
            >
              Continuar para pagamento <ChevronRight size={18} />
            </Button>

            {/* Selo de pagamento seguro */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock size={11} />
              <span>Pagamento seguro via Asaas · PIX e Cartão</span>
            </div>

            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mx-auto w-full justify-center pt-1"
            >
              <LogOut size={12} /> Sair da conta
            </button>
          </div>
        </motion.div>
      </div>
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={(v) => {
          setCheckoutOpen(v);
          if (!v) {
            try { sessionStorage.removeItem(CHECKOUT_PLAN_KEY); } catch {}
          }
        }}
        initialPlan={initialPlan}
      />
    </>
  );
}
