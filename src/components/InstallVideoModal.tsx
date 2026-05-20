import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share, Plus, MoreVertical, Smartphone } from 'lucide-react';

const SEEN_KEY = 'influlab.installVideoSeen';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function InlineIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center align-middle h-7 w-7 mx-1 rounded-md border border-border bg-muted text-foreground"
    >
      {children}
    </span>
  );
}

function IOSContent() {
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-foreground">
        Adicione o <strong>Vyral Lab</strong> à sua tela inicial para receber notificações e acesso rápido.
        <br />
        Toque em <strong>Compartilhar</strong>
        <InlineIcon><Share className="h-4 w-4" /></InlineIcon>
        e depois em <strong>Adicionar à Tela de Início</strong>
        <InlineIcon><Plus className="h-4 w-4" /></InlineIcon>
      </p>

      {/* Mockup da barra inferior do Safari */}
      <div className="rounded-2xl bg-muted/40 border border-border p-3 flex items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted-foreground/20 text-foreground text-sm font-medium">
          <span className="opacity-70">aA</span>
          <span>app.vyrallab.online</span>
          <Share className="h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );
}

function AndroidContent() {
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-foreground">
        Adicione o <strong>Vyral Lab</strong> à sua tela inicial para receber notificações e acesso rápido.
        <br />
        Toque no menu
        <InlineIcon><MoreVertical className="h-4 w-4" /></InlineIcon>
        no canto superior direito e depois em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
        <InlineIcon><Plus className="h-4 w-4" /></InlineIcon>
      </p>

      {/* Mockup da barra superior do Chrome */}
      <div className="rounded-2xl bg-muted/40 border border-border p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted-foreground/20 text-foreground text-sm font-medium flex-1 truncate">
          <span className="truncate">app.vyrallab.online</span>
        </div>
        <div className="h-9 w-9 rounded-full bg-muted-foreground/20 flex items-center justify-center">
          <MoreVertical className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function OtherContent() {
  return (
    <div className="space-y-3 text-center">
      <Smartphone className="h-10 w-10 text-primary mx-auto" />
      <p className="text-sm text-muted-foreground">
        Abra o <strong>Vyral Lab</strong> no seu celular para instalar como app na tela inicial.
      </p>
    </div>
  );
}

export function InstallVideoModal({ open, onOpenChange }: Props) {
  const platform = useMemo(() => detectPlatform(), []);

  const handleDontShowAgain = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] p-5 sm:p-6">
        <DialogHeader className="space-y-1.5 text-center">
          <DialogTitle className="font-serif text-xl">📲 Adicione à tela inicial</DialogTitle>
          <DialogDescription className="text-xs">
            Em 30 segundos seu Vyral Lab vira app — push, acesso rápido e tela cheia.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {platform === 'ios' && <IOSContent />}
          {platform === 'android' && <AndroidContent />}
          {platform === 'other' && <OtherContent />}
        </div>

        <div className="flex flex-col gap-2 pt-3">
          <Button
            onClick={handleDontShowAgain}
            className="gold-gradient text-primary-foreground"
          >
            Já instalei
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground"
          >
            Ver depois
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const INSTALL_VIDEO_SEEN_KEY = SEEN_KEY;
