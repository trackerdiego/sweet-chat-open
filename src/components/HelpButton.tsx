import { HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TutorialTopic } from '@/data/tutorials';

interface HelpButtonProps {
  topic: TutorialTopic;
  /** Variante visual: 'light' = branco translúcido (para gradient-header escuro), 'dark' = sobre fundo claro */
  variant?: 'light' | 'dark';
  className?: string;
  label?: string;
}

/**
 * Botão "?" contextual que leva o usuário ao tutorial correspondente em /ajuda.
 * Use no header de cada página de funcionalidade.
 */
export function HelpButton({ topic, variant = 'light', className, label = 'Ver tutorial' }: HelpButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => navigate(`/ajuda#${topic}`)}
      className={cn(
        'rounded-full',
        variant === 'light'
          ? 'text-white/70 hover:text-white hover:bg-white/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        className,
      )}
    >
      <HelpCircle size={18} />
    </Button>
  );
}
