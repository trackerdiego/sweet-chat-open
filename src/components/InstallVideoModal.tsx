import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
      className="inline-flex items-center justify-center align-middle h-8 w-8 mx-1 rounded-lg border-2 border-primary/30 bg-primary/5 text-primary shadow-sm"
    >
      {children}
    </span>
  );
}

function IOSContent() {
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-[1.7] text-foreground">
        Adicione o <strong>Vyral Lab</strong> à sua tela inicial para receber notificações e acesso rápido.
        <br />
        Toque em <strong>Compartilhar</strong>
        <InlineIcon><Share className="h-4 w-4" /></InlineIcon>
        e depois em <strong>Adicionar à Tela de Início</strong>
        <InlineIcon><Plus className="h-4 w-4" /></InlineIcon>
      </p>
    </div>
  );
}

function AndroidContent() {
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-[1.7] text-foreground">
        Adicione o <strong>Vyral Lab</strong> à sua tela inicial para receber notificações e acesso rápido.
        <br />
        Toque no menu
        <InlineIcon><MoreVertical className="h-4 w-4" /></InlineIcon>
        no canto superior direito e depois em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
        <InlineIcon><Plus className="h-4 w-4" /></InlineIcon>
      </p>
    </div>
  );
}

function OtherContent() {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Smartphone className="h-6 w-6 text-primary" />
      </div>
      <p className="text-[15px] leading-relaxed text-foreground pt-1">
        Abra o <strong>Vyral Lab</strong> no seu celular para instalar como app na tela inicial e receber notificações.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-t border-border/60 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-[520px] sm:mx-auto sm:left-0 sm:right-0"
      >
        {/* Handle visual de bottom sheet */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" />

        <SheetHeader className="space-y-1.5 text-left">
          <SheetTitle className="font-serif text-xl flex items-center gap-2">
            <span aria-hidden>📲</span>
            Adicione à tela inicial
          </SheetTitle>
          <SheetDescription className="text-xs">
            Em 30 segundos seu Vyral Lab vira app — push, acesso rápido e tela cheia.
          </SheetDescription>
        </SheetHeader>

        <div className="pt-4">
          {platform === 'ios' && <IOSContent />}
          {platform === 'android' && <AndroidContent />}
          {platform === 'other' && <OtherContent />}
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            onClick={handleDontShowAgain}
            className="gold-gradient text-primary-foreground h-11"
          >
            Já instalei
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground h-9"
          >
            Ver depois
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const INSTALL_VIDEO_SEEN_KEY = SEEN_KEY;
