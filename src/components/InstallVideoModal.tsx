import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const WISTIA_ID = 'e9u6kg4om8';
const SEEN_KEY = 'influlab.installVideoSeen';

function ensureWistiaScripts() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('script[data-wistia-player]')) {
    const s = document.createElement('script');
    s.src = 'https://fast.wistia.com/player.js';
    s.async = true;
    s.setAttribute('data-wistia-player', '1');
    document.head.appendChild(s);
  }
  if (!document.querySelector(`script[data-wistia-media="${WISTIA_ID}"]`)) {
    const s = document.createElement('script');
    s.src = `https://fast.wistia.com/embed/${WISTIA_ID}.js`;
    s.async = true;
    s.type = 'module';
    s.setAttribute('data-wistia-media', WISTIA_ID);
    document.head.appendChild(s);
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallVideoModal({ open, onOpenChange }: Props) {
  useEffect(() => {
    if (open) ensureWistiaScripts();
  }, [open]);

  const handleDontShowAgain = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] p-4 sm:p-6">
        <DialogHeader className="space-y-1.5 text-center">
          <DialogTitle className="font-serif text-xl">📲 Adicione à tela inicial</DialogTitle>
          <DialogDescription className="text-xs">
            Em 30 segundos seu Vyral Lab vira app — push, acesso rápido e tela cheia.
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl bg-charcoal/60 ring-1 ring-white/10"
          style={{ aspectRatio: '9 / 16' }}
        >
          <wistia-player media-id={WISTIA_ID} aspect="0.5625" style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        <div className="flex flex-col gap-2 pt-1">
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
