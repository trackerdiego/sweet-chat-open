import { useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { InstallInstructionsModal } from '@/components/InstallInstructionsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const DISMISS_KEY = 'install-banner-dismissed';
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

export function InstallBanner() {
  const { canInstall, isIOS, isStandalone, promptInstall, hasNativePrompt } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(isDismissed);
  const [modalOpen, setModalOpen] = useState(false);

  if (isStandalone || !canInstall || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (hasNativePrompt) {
      const result = await promptInstall();
      if (result === 'accepted') {
        toast.success('App instalado com sucesso! 🎉');
        handleDismiss();
      }
    } else if (isIOS) {
      setModalOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 shadow-lg"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isIOS ? <Share className="h-5 w-5 shrink-0" /> : <Download className="h-5 w-5 shrink-0" />}
            <span className="text-sm font-semibold">
              {isIOS
                ? 'Adicione o InfluLab à tela de início'
                : 'Instale o app para melhor experiência'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleInstall}
              className="h-8 px-4 text-xs font-bold"
            >
              {isIOS ? 'Ver como instalar' : 'Instalar'}
            </Button>
            <button onClick={handleDismiss} className="p-1 hover:bg-primary-foreground/20 rounded transition-colors" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <InstallInstructionsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode="safari"
      />
    </>
  );
}
