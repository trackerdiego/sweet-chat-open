import { useMemo as _useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MoreVertical, Smartphone } from 'lucide-react';

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

// iOS native Share icon (square with up arrow)
function IOSShareIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v13" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

// iOS native "Add to Home Screen" icon (plus inside rounded square)
function IOSAddIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function InlineSquare({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center align-[-0.25em] h-7 w-7 mx-1 text-foreground"
    >
      {children}
    </span>
  );
}

function IOSContent() {
  return (
    <p className="text-[16px] leading-[1.75] text-foreground">
      Adicione o aplicativo <strong>Vyral Lab</strong> à sua tela inicial para receber atualizações regulares.
      <br />
      Toque em <strong>Compartilhar</strong>
      <InlineSquare><IOSShareIcon className="h-6 w-6" /></InlineSquare>
      e depois em <strong>Adicionar à Tela de Início</strong>
      <InlineSquare><IOSAddIcon className="h-6 w-6" /></InlineSquare>
    </p>
  );
}

function AndroidContent() {
  return (
    <p className="text-[16px] leading-[1.75] text-foreground">
      Adicione o aplicativo <strong>Vyral Lab</strong> à sua tela inicial para receber atualizações regulares.
      <br />
      Toque no menu
      <InlineSquare><MoreVertical className="h-6 w-6" /></InlineSquare>
      do navegador e depois em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
      <InlineSquare><IOSAddIcon className="h-6 w-6" /></InlineSquare>
    </p>
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
