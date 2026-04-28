import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { usePendingInvoice } from '@/hooks/usePendingInvoice';

export function PixDueBanner() {
  const { invoice, hasUrgentInvoice, daysUntilDue } = usePendingInvoice();
  const navigate = useNavigate();
  const location = useLocation();

  if (!hasUrgentInvoice || !invoice) return null;
  // Não exibir na própria tela de renovação
  if (location.pathname.startsWith('/renovar')) return null;

  const urgent = (daysUntilDue ?? 0) <= 1;
  const label =
    daysUntilDue === 0 ? 'vence hoje'
    : daysUntilDue === 1 ? 'vence amanhã'
    : `vence em ${daysUntilDue} dias`;

  return (
    <button
      onClick={() => navigate('/renovar')}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
        urgent
          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : 'bg-amber-500 text-white hover:bg-amber-500/90'
      }`}
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2 text-left">
        <AlertTriangle size={16} className="shrink-0" />
        <span>
          Sua fatura Pix de R$ {invoice.value.toFixed(2).replace('.', ',')} {label}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="hidden sm:inline">Pagar agora</span>
        <ArrowRight size={16} />
      </div>
    </button>
  );
}
