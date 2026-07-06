import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Crown, Gift, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckoutModal } from '@/components/CheckoutModal';
import { logDiagnostic } from '@/lib/diagnostics';

const ALWAYS_OPEN = ['/onboarding', '/carteira', '/indique', '/ajuda', '/renovar'];

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const sub = useSubscription();
  const { hasAccess, isExpired, isPastDueOrCanceled, loading } = sub;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const loggedForPathRef = useRef<string | null>(null);

  const isAlwaysOpen = ALWAYS_OPEN.some(p => location.pathname.startsWith(p));
  const shouldBlock = !loading && !hasAccess && !isAlwaysOpen;

  useEffect(() => {
    if (!shouldBlock) return;
    if (loggedForPathRef.current === location.pathname) return;
    loggedForPathRef.current = location.pathname;
    logDiagnostic('access_guard_blocked', 'AccessGuard', {
      subscription: {
        status: sub.status,
        plan: sub.plan,
        current_period_end: sub.currentPeriodEnd,
        trial_ends_at: sub.trialEndsAt,
        first_paid_at: sub.firstPaidAt,
        asaas_customer_id: sub.asaasCustomerId,
      },
      hasLoadedOnce: sub.hasLoadedOnce,
      isAdmin: sub.isAdmin,
      isExpired: sub.isExpired,
      isPastDueOrCanceled: sub.isPastDueOrCanceled,
      hasAccess: sub.hasAccess,
    });
  }, [shouldBlock, location.pathname, sub.status, sub.hasLoadedOnce]);

  if (loading) return <>{children}</>;
  if (hasAccess) return <>{children}</>;
  if (isAlwaysOpen) return <>{children}</>;

  const headline = isPastDueOrCanceled
    ? 'Sua assinatura está pendente'
    : isExpired
      ? 'Seu período de avaliação acabou'
      : 'Assine para desbloquear o app';
  const subCopy = isPastDueOrCanceled
    ? 'Regularize o pagamento para voltar a usar todos os recursos.'
    : 'Escolha um plano abaixo pra desbloquear o app. Em segundos você está dentro.';

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
            <p className="text-sm text-muted-foreground mt-2">{subCopy}</p>
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2 text-left">
            <Clock size={14} className="text-primary shrink-0" />
            <span>Você mantém todos os seus dados, indicações e coins acumulados.</span>
          </div>

          <Button
            onClick={() => isPastDueOrCanceled ? navigate('/renovar') : setCheckoutOpen(true)}
            className="w-full gold-gradient text-primary-foreground gap-2 h-11"
          >
            <Crown size={18} /> {isPastDueOrCanceled ? 'Pagar fatura pendente' : 'Assinar agora'}
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
