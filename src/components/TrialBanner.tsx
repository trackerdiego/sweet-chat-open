import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckoutModal } from '@/components/CheckoutModal';

export function TrialBanner() {
  const { isTrialing, daysLeftInTrial } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!isTrialing || dismissed) return null;

  return (
    <>
      <div
        className="sticky top-0 z-40 bg-primary text-primary-foreground text-sm px-3 py-2 flex items-center gap-2 md:relative md:top-auto"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <Sparkles size={14} className="shrink-0" />
        <span className="flex-1 truncate">
          {daysLeftInTrial === 1
            ? 'Último dia grátis — assine agora pra continuar'
            : `${daysLeftInTrial} dias grátis restantes`}
        </span>
        <button
          onClick={() => setCheckoutOpen(true)}
          className="bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors rounded-full px-3 py-0.5 text-xs font-semibold"
        >
          Assinar
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fechar"
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
