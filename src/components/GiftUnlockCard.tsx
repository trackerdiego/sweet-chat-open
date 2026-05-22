// GiftUnlockCard — anti-chargeback. Trava as Trends Virais do YouTube por 8 dias
// a partir do primeiro PAYMENT_RECEIVED confirmado. Antes disso, mostra um
// card dourado pulsante com contador regressivo.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { HypeOfTheDay } from '@/components/HypeOfTheDay';

const UNLOCK_DAYS = 8;

function formatRemaining(ms: number): { days: number; hours: number; minutes: number; underDay: boolean } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, underDay: days === 0 };
}

export function GiftUnlockCard() {
  const { firstPaidAt, isActive, asaasCustomerId, loading } = useSubscription();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) return null;

  // Equipe (premium manual sem customer Asaas) ou sem primeira data de pagamento
  // mas com is_premium=true via bypass → libera direto.
  const isManualPremium = isActive && !asaasCustomerId && !firstPaidAt;
  if (isManualPremium) return <HypeOfTheDay />;

  // Sem assinatura paga ainda — mostra card "aguardando primeiro pagamento"
  if (!firstPaidAt) {
    return (
      <GiftCard
        title="Seu bônus tá chegando"
        subtitle="Liberado após o primeiro pagamento confirmado"
        bigText="Aguardando confirmação"
        small="Hype do dia — tendências virais do Brasil"
      />
    );
  }

  const unlockAt = new Date(firstPaidAt).getTime() + UNLOCK_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = unlockAt - now;

  if (remainingMs <= 0) {
    return <HypeOfTheDay />;
  }

  const { days, hours, minutes, underDay } = formatRemaining(remainingMs);
  const bigText = underDay
    ? `${hours}h ${minutes}m`
    : `${days}d ${hours}h ${minutes}m`;

  const title = underDay ? 'Liberando em instantes!' : 'Bônus exclusivo desbloqueando';
  const subtitle = underDay
    ? 'Atualize a página em algumas horas'
    : `Liberado em ${days + 1} ${days + 1 === 1 ? 'dia' : 'dias'}`;

  return (
    <GiftCard
      title={title}
      subtitle={subtitle}
      bigText={bigText}
      small="Hype do dia — tendências virais do Brasil"
    />
  );
}

function GiftCard({
  title,
  subtitle,
  bigText,
  small,
}: {
  title: string;
  subtitle: string;
  bigText: string;
  small: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-[2px]"
      style={{
        background:
          'linear-gradient(135deg, hsl(45 95% 60%), hsl(38 100% 50%), hsl(48 100% 70%), hsl(38 100% 50%))',
        backgroundSize: '200% 200%',
        animation: 'giftShimmer 4s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes giftShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes giftPulse {
          0%, 100% { box-shadow: 0 0 30px hsl(45 95% 55% / 0.45), 0 0 60px hsl(38 100% 50% / 0.25); }
          50% { box-shadow: 0 0 50px hsl(45 95% 60% / 0.7), 0 0 90px hsl(38 100% 50% / 0.4); }
        }
        @keyframes giftIconBob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
        }
        .gift-pulse { animation: giftPulse 2.4s ease-in-out infinite; }
        .gift-bob { animation: giftIconBob 2.8s ease-in-out infinite; }
      `}</style>
      <div
        className="gift-pulse relative rounded-3xl px-5 py-6 sm:px-6 sm:py-7 text-center"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, hsl(45 80% 18%), hsl(30 60% 8%) 70%)',
        }}
      >
        {/* sparkles decorativas */}
        <Sparkles
          size={14}
          className="absolute top-4 left-6 text-amber-200/70"
          style={{ filter: 'drop-shadow(0 0 6px hsl(45 100% 70%))' }}
        />
        <Sparkles
          size={10}
          className="absolute top-8 right-10 text-amber-300/60"
          style={{ filter: 'drop-shadow(0 0 4px hsl(45 100% 70%))' }}
        />
        <Sparkles
          size={12}
          className="absolute bottom-6 left-12 text-amber-200/60"
          style={{ filter: 'drop-shadow(0 0 5px hsl(45 100% 70%))' }}
        />

        {/* ícone presente com cadeado */}
        <div className="relative mx-auto mb-4 inline-block">
          <div
            className="gift-bob inline-flex items-center justify-center rounded-2xl p-3"
            style={{
              background:
                'linear-gradient(135deg, hsl(45 95% 55%), hsl(38 100% 48%))',
              boxShadow: '0 8px 24px hsl(38 100% 40% / 0.5)',
            }}
          >
            <Gift size={40} className="text-amber-950" strokeWidth={2.5} />
          </div>
          <div
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full p-1.5 ring-2 ring-amber-950"
            style={{
              background: 'linear-gradient(135deg, hsl(45 95% 60%), hsl(38 100% 50%))',
            }}
          >
            <Lock size={12} className="text-amber-950" strokeWidth={3} />
          </div>
        </div>

        <h3 className="font-display text-lg sm:text-xl font-bold text-amber-100 tracking-tight">
          {title} <span className="inline-block">🎁</span>
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-amber-200/80">{subtitle}</p>

        <div
          className="mt-4 font-display text-3xl sm:text-4xl font-bold tabular-nums"
          style={{
            background:
              'linear-gradient(135deg, hsl(48 100% 75%), hsl(38 100% 55%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 24px hsl(45 100% 60% / 0.3)',
          }}
        >
          {bigText}
        </div>

        <p className="mt-3 text-[11px] sm:text-xs uppercase tracking-widest text-amber-300/80">
          {small}
        </p>
      </div>
    </motion.section>
  );
}
