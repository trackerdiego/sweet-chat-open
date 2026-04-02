import { useState } from 'react';
import { ExternalLink, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInAppBrowser } from '@/hooks/useInAppBrowser';
import { toast } from 'sonner';

export function InAppBrowserBanner() {
  const { isInApp, isIOS, isAndroid } = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);

  if (!isInApp || dismissed) return null;

  const currentUrl = window.location.href;

  const handleOpen = () => {
    if (isAndroid) {
      // Intent scheme to open in Chrome / default browser
      const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;end`;
      window.location.href = intentUrl;
    } else {
      // iOS: copy link and instruct user
      navigator.clipboard?.writeText(currentUrl).then(() => {
        toast.success('Link copiado! Cole no Safari para abrir.', { duration: 6000 });
      }).catch(() => {
        toast.info(`Copie este link e abra no Safari: ${currentUrl}`, { duration: 8000 });
      });
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] bg-accent text-accent-foreground px-4 py-3 shadow-lg"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-start gap-3 max-w-md mx-auto">
        <ExternalLink className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {isIOS
              ? 'Abra no Safari para melhor experiência'
              : 'Abra no navegador para melhor experiência'}
          </p>
          <p className="text-xs opacity-80 mt-0.5">
            {isIOS
              ? 'Toque abaixo para copiar o link e cole no Safari'
              : 'Toque abaixo para abrir no seu navegador'}
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpen}
              className="h-7 px-3 text-xs font-semibold"
            >
              {isIOS ? (
                <><Copy className="h-3 w-3 mr-1" /> Copiar link</>
              ) : (
                <><ExternalLink className="h-3 w-3 mr-1" /> Abrir no navegador</>
              )}
            </Button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-foreground/10 rounded transition-colors" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
