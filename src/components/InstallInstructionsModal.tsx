import { Share, Plus, ArrowUp, Copy, Globe, Smartphone } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'safari' | 'in-app';
  onCopyLink?: () => void;
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg shrink-0">
        {number}
      </div>
      <div className="flex items-start gap-3 pt-1.5">
        {icon}
        <p className="text-base leading-snug">{text}</p>
      </div>
    </div>
  );
}

function SafariSteps() {
  return (
    <div className="flex flex-col gap-5">
      <Step
        number={1}
        icon={<ArrowUp className="h-7 w-7 text-primary shrink-0" />}
        text='Toque no ícone de compartilhar (↑) na barra inferior do Safari'
      />
      <Step
        number={2}
        icon={<Plus className="h-7 w-7 text-primary shrink-0" />}
        text='Role para baixo e toque em "Adicionar à Tela de Início"'
      />
      <Step
        number={3}
        icon={<Smartphone className="h-7 w-7 text-primary shrink-0" />}
        text='Toque em "Adicionar" no canto superior direito. Pronto!'
      />
    </div>
  );
}

function InAppSteps({ onCopyLink }: { onCopyLink?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg shrink-0">
          1
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-base leading-snug">Copie o link do InfluLab</p>
          {onCopyLink && (
            <Button onClick={onCopyLink} size="sm" className="w-fit">
              <Copy className="h-4 w-4 mr-2" /> Copiar link
            </Button>
          )}
        </div>
      </div>
      <Step
        number={2}
        icon={<Globe className="h-7 w-7 text-primary shrink-0" />}
        text="Abra o Safari no seu celular"
      />
      <Step
        number={3}
        icon={<Share className="h-7 w-7 text-primary shrink-0" />}
        text="Cole o link na barra de endereço e acesse o site"
      />
      <Step
        number={4}
        icon={<Smartphone className="h-7 w-7 text-primary shrink-0" />}
        text='No Safari, toque em (↑) → "Adicionar à Tela de Início" → "Adicionar"'
      />
    </div>
  );
}

function ModalBody({ mode, onCopyLink }: Pick<Props, 'mode' | 'onCopyLink'>) {
  return (
    <div className="py-2">
      {mode === 'safari' ? <SafariSteps /> : <InAppSteps onCopyLink={onCopyLink} />}
    </div>
  );
}

export function InstallInstructionsModal({ open, onOpenChange, mode, onCopyLink }: Props) {
  const isMobile = useIsMobile();

  const title = 'Instale o InfluLab no seu celular';
  const description = mode === 'safari'
    ? 'Siga os passos abaixo para adicionar o app à sua tela inicial'
    : 'Para instalar, você precisa abrir no Safari primeiro';

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-6 pb-8">
          <DrawerHeader className="text-left px-0">
            <DrawerTitle className="text-xl">{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <ModalBody mode={mode} onCopyLink={onCopyLink} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ModalBody mode={mode} onCopyLink={onCopyLink} />
      </DialogContent>
    </Dialog>
  );
}
