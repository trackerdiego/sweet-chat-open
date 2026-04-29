import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Coins, Gift, ArrowRight, TrendingUp, CheckCircle2, Flame, Tag, QrCode, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useSubscription } from '@/hooks/useSubscription';
import { usePendingInvoice } from '@/hooks/usePendingInvoice';
import { Button } from '@/components/ui/button';

const COIN_TO_BRL = 0.01;

const TYPE_LABEL: Record<string, { label: string; icon: typeof Coins }> = {
  task_complete: { label: 'Tarefa concluída', icon: CheckCircle2 },
  streak_bonus: { label: 'Bônus de streak', icon: Flame },
  referral_bonus: { label: 'Indicação paga', icon: Gift },
  redeem_discount: { label: 'Desconto aplicado', icon: Tag },
  adjust: { label: 'Ajuste', icon: TrendingUp },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Wallet() {
  const { wallet, transactions, loading } = useWallet();
  const { isActive, currentPeriodEnd, plan } = useSubscription();
  const { invoice, hasPendingPixInvoice, daysUntilDue } = usePendingInvoice();
  const navigate = useNavigate();

  const discountBrl = wallet.coins_balance * COIN_TO_BRL;
  const planPrice = plan === 'annual' ? 397 : 47;
  const totalCredit = discountBrl + Number(wallet.referral_credits_brl);
  const nextDiscount = Math.min(totalCredit, planPrice);
  const renewalDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  return (
    <div className="min-h-screen pb-24 md:pb-6 md:pt-20">
      <div className="gradient-header px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12 rounded-b-3xl text-center">
        <h1 className="font-serif text-2xl font-bold text-white">Sua carteira 🪙</h1>
        <p className="text-white/60 text-sm mt-1">Ganhe coins e desconto na assinatura</p>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Coins size={28} />
            <span className="text-4xl font-bold tabular-nums">{loading ? '—' : wallet.coins_balance}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">≈ R$ {discountBrl.toFixed(2)} em desconto</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Total acumulado: {wallet.lifetime_coins_earned} coins</p>
        </motion.div>

        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
          className="glass-card p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-foreground">
              <Gift size={18} className="text-primary" />
              <span className="font-semibold">Créditos de indicação</span>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums">R$ {Number(wallet.referral_credits_brl).toFixed(2)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/indique')}>
            Indicar <ArrowRight size={14} />
          </Button>
        </motion.div>

        {isActive && nextDiscount > 0 ? (
          <div className="bg-primary/10 border border-primary/25 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground">🎯 Próximo desconto previsto</p>
            <p className="text-2xl font-bold text-primary mt-1 tabular-nums">−R$ {nextDiscount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aplicado automaticamente {renewalDate ? `em ${renewalDate}` : 'na próxima fatura'} · Valor cheio: R$ {planPrice.toFixed(2)}
            </p>
          </div>
        ) : (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-muted-foreground">
            💡 {isActive
              ? 'Acumule coins concluindo tarefas para ganhar desconto na próxima fatura.'
              : 'Quando você assinar, seus coins viram desconto automático na mensalidade.'}
          </div>
        )}

        <div>
          <h2 className="font-semibold text-foreground px-1 mb-2">Histórico</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground px-1">Carregando…</div>
          ) : transactions.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Sem movimentações ainda. Conclua tarefas para começar a ganhar coins.
            </div>
          ) : (
            <ul className="space-y-2">
              {transactions.map(tx => {
                const meta = TYPE_LABEL[tx.type] ?? { label: tx.type, icon: Coins };
                const Icon = meta.icon;
                const positive = tx.amount > 0;
                return (
                  <li key={tx.id} className="glass-card p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(tx.created_at)}</p>
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${positive ? 'text-primary' : 'text-destructive'}`}>
                      {positive ? '+' : ''}{tx.amount}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
