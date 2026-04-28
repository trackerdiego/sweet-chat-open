import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Crown, Gift, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckoutModal } from '@/components/CheckoutModal';

const ALWAYS_OPEN = ['/onboarding', '/carteira', '/indique'];

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const { hasAccess, isExpired, isPastDueOrCanceled, loading } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <>{children}</>;
  if (hasAccess) return <>{children}</>;
  if (ALWAYS_OPEN.some(p => location.pathname.startsWith(p))) return <>{children}</>;

  const headline = isPastDueOrCanceled
    ? 'Sua assinatura está pendente'
    : isExpired
      ? 'Seu trial gratuito acabou'
      : 'Acesso bloqueado';
  const sub = isPastDueOrCanceled
    ? 'Regularize o pagamento para voltar a usar todos os recursos.'
    : 'Para continuar criando, escolha um plano abaixo. Em segundos você está de volta.';

  return (
    <>
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10 pb-24 md:pb-10 md:pt-24">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="glass-card max-w-md w-full p-7 text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{headline}</h1>
            <p className="text-sm text-muted-foreground mt-2">{sub}</p>
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2 text-left">
            <Clock size={14} className="text-primary shrink-0" />
            <span>Você mantém todos os seus dados, indicações e coins acumulados.</span>
          </div>

          <Button
            onClick={() => setCheckoutOpen(true)}
            className="w-full gold-gradient text-primary-foreground gap-2 h-11"
          >
            <Crown size={18} /> Assinar agora
          </Button>

          <Button variant="outline" onClick={() => navigate('/indique')} className="w-full gap-2">
            <Gift size={16} /> Indicar amigos e ganhar créditos
          </Button>
        </motion.div>
      </div>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
