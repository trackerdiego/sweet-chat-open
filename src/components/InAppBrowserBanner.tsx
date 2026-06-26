import { useEffect, useState } from 'react';
import { ExternalLink, Copy, X } from 'lucide-react';
import { useInAppBrowser } from '@/hooks/useInAppBrowser';
import { InstallInstructionsModal } from '@/components/InstallInstructionsModal';
import { toast } from 'sonner';

/**
 * Slim top bar (~44px) shown ONLY after the user has scrolled past the hero (>600px).
 * Goal: stop covering the first fold for Instagram in-app visitors — they decide
 * if they want to install AFTER seeing the value prop, not before.
 */
export function InAppBrowserBanner() {
  const { isInApp, isIOS, isAndroid } = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isInApp || dismissed) return;
    const onScroll = () => {
      if (window.scrollY > 600) setScrolled(true);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isInApp, dismissed]);

  if (!isInApp || dismissed || !scrolled) return null;

  const currentUrl = window.location.href;

  const copyLink = () => {
    navigator.clipboard?.writeText(currentUrl).then(() => {
      toast.success('Link copiado!', { duration: 3000 });
    }).catch(() => {
      toast.info(`Copie: ${currentUrl}`, { duration: 8000 });
    });
  };

  const handleOpen = () => {
    if (isAndroid) {
      const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;end`;
      window.location.href = intentUrl;
    } else {
      copyLink();
      setModalOpen(true);
    }
  };

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[70] bg-primary/95 backdrop-blur text-primary-foreground shadow-lg"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2 max-w-md mx-auto px-3 py-2">
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center gap-2 min-w-0 text-left active:opacity-80"
            aria-label="Instalar como app"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold truncate">
              {isIOS ? '📱 Instale como app — abra no Safari' : '📱 Instale como app — abra no navegador'}
            </span>
            {isIOS ? <Copy className="h-3.5 w-3.5 shrink-0 opacity-80" /> : <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 hover:bg-primary-foreground/20 rounded-full transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <InstallInstructionsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode="in-app"
        onCopyLink={copyLink}
      />
    </>
  );
}
