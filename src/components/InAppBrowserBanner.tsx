import { useState } from 'react';
import { ExternalLink, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInAppBrowser } from '@/hooks/useInAppBrowser';
import { InstallInstructionsModal } from '@/components/InstallInstructionsModal';
import { toast } from 'sonner';

export function InAppBrowserBanner() {
  const { isInApp, isIOS, isAndroid } = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!isInApp || dismissed) return null;

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
        className="fixed top-0 left-0 right-0 z-[70] bg-primary text-primary-foreground px-4 py-4 shadow-lg"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-start gap-3 max-w-md mx-auto">
          <ExternalLink className="h-6 w-6 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">
              {isIOS
                ? 'Abra no Safari para instalar o app'
                : 'Abra no navegador para instalar o app'}
            </p>
            <p className="text-sm opacity-90 mt-1">
              {isIOS
                ? 'O Instagram/app não permite instalar. Toque abaixo para ver como fazer.'
                : 'Toque abaixo para abrir no seu navegador'}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOpen}
                className="h-9 px-4 text-sm font-bold"
              >
                {isIOS ? (
                  <><Copy className="h-4 w-4 mr-1.5" /> Como instalar</>
                ) : (
                  <><ExternalLink className="h-4 w-4 mr-1.5" /> Abrir no navegador</>
                )}
              </Button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-primary-foreground/20 rounded transition-colors" aria-label="Fechar">
            <X className="h-4 w-4" />
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
