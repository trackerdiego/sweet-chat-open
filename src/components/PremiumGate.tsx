import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/CheckoutModal';

interface PremiumGateProps {
  locked: boolean;
  children: React.ReactNode;
  message?: string;
}

export function PremiumGate({ locked, children, message }: PremiumGateProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-[2px] rounded-xl"
      >
        <div className="p-3 rounded-full bg-primary/10">
          <Lock size={24} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-center px-4 max-w-xs">
          {message || 'Conteúdo exclusivo para assinantes'}
        </p>
        <Button
          onClick={() => setCheckoutOpen(true)}
          className="gold-gradient text-primary-foreground gap-2"
        >
          <Crown size={16} />
          Desbloquear acesso completo
        </Button>
      </motion.div>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
