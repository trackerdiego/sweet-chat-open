import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown, LogOut, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/CheckoutModal';
import { useUserProfile } from '@/hooks/useUserProfile';

const CHECKOUT_PLAN_KEY = 'pending_checkout_plan';

const BULLETS = [
  'Matriz personalizada de 30 dias gerada por IA',
  'Scripts prontos com hooks, storytelling e CTAs',
  'Guia diário — nunca mais "o que postar hoje?"',
  '4 ferramentas IA + transcrição de vídeos virais',
  'Análise visceral da sua audiência',
];

/**
 * Tela de paywall mostrada após signup quando o usuário ainda não tem
 * assinatura ativa. Abre o CheckoutModal automaticamente com o plano
 * escolhido na landing e mantém o usuário bloqueado fora do onboarding
 * até o webhook Asaas marcar status='active'.
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
      // Mesmo sem plano pendente, abre automaticamente para empurrar a conversão
      setCheckoutOpen(true);
    }
  }, []);

  return (
    <>
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-card max-w-md w-full p-7 text-center space-y-5"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Falta só o último passo
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Finalize sua assinatura para liberar a IA que vai montar sua estratégia.
            </p>
          </div>

          <ul className="text-left space-y-2.5">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2 text-left">
            <Sparkles size={14} className="text-primary shrink-0" />
            <span>Cancele quando quiser, sem multa. Pagamento processado pela Asaas.</span>
          </div>

          <Button
            onClick={() => setCheckoutOpen(true)}
            className="w-full gold-gradient text-primary-foreground gap-2 h-11"
          >
            <Crown size={18} /> Assinar agora
          </Button>

          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mx-auto"
          >
            <LogOut size={12} /> Sair da conta
          </button>
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
