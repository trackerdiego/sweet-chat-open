import { motion } from 'framer-motion';
import { Gift, Copy, Share2, MessageCircle, Send, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useReferrals } from '@/hooks/useReferrals';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SHARE_BASE = 'https://app.influlab.pro/auth?ref=';

function maskName(name: string | null | undefined): string {
  if (!name) return 'Novo usuário';
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[1]?.[0];
  return last ? `${first} ${last}.` : first;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  pending: { label: 'Aguardando 1º pagamento', icon: Clock, cls: 'text-muted-foreground' },
  paid: { label: 'Pagou — você ganhou R$ 10', icon: CheckCircle2, cls: 'text-primary' },
  expired: { label: 'Expirou', icon: XCircle, cls: 'text-destructive' },
};

export default function Referral() {
  const { code, referrals, paidCount, totalEarnedBrl, loading } = useReferrals();
  const link = code ? `${SHARE_BASE}${code}` : '';
  const message = `Olha esse app que tá me ajudando a crescer como creator: ${link}`;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado!');
    } catch { toast.error('Não consegui copiar'); }
  };

  const shareWhats = () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  const shareTg = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Olha esse app pra creators 👇')}`, '_blank');
  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'InfluLab', text: message, url: link }); } catch {}
    } else copy();
  };

  return (
    <div className="min-h-screen pb-24 md:pb-6 md:pt-20">
      <div className="gradient-header px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12 rounded-b-3xl text-center">
        <h1 className="font-serif text-2xl font-bold text-white">Indique amigos 🎁</h1>
        <p className="text-white/60 text-sm mt-1">Ganhe R$ 10 por cada pagante</p>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu código</p>
          <p className="font-mono text-2xl font-bold text-primary mt-1 break-all">
            {loading ? '—' : code ?? 'Gerando…'}
          </p>
          <div className="mt-4 bg-muted/40 rounded-lg p-2 text-xs text-muted-foreground break-all">{link || '—'}</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={copy} disabled={!link}><Copy size={14} /> Copiar</Button>
            <Button size="sm" onClick={shareNative} disabled={!link} className="gold-gradient text-primary-foreground"><Share2 size={14} /> Compartilhar</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={shareWhats} disabled={!link}><MessageCircle size={14} /> WhatsApp</Button>
            <Button variant="ghost" size="sm" onClick={shareTg} disabled={!link}><Send size={14} /> Telegram</Button>
          </div>
        </motion.div>

        <div className="glass-card p-4 flex items-center justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-primary tabular-nums">{paidCount}</p>
            <p className="text-xs text-muted-foreground">Pagantes</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <p className="text-2xl font-bold text-primary tabular-nums">R$ {totalEarnedBrl.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Ganhos</p>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-muted-foreground flex gap-3">
          <Gift size={18} className="text-primary shrink-0 mt-0.5" />
          <p>Quando seu indicado pagar a 1ª mensalidade, você recebe <strong className="text-foreground">R$ 10 em créditos</strong> automaticamente na sua carteira.</p>
        </div>

        <div>
          <h2 className="font-semibold text-foreground px-1 mb-2">Suas indicações</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground px-1">Carregando…</div>
          ) : referrals.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Você ainda não indicou ninguém. Compartilhe seu link!
            </div>
          ) : (
            <ul className="space-y-2">
              {referrals.map(r => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <li key={r.id} className="glass-card p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{maskName(r.referred_name)}</p>
                      <p className={`text-xs ${meta.cls}`}>{meta.label}</p>
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
