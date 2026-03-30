import fitnessIcon from '@/assets/niches/fitness.png';
import belezaIcon from '@/assets/niches/beleza.png';
import modaIcon from '@/assets/niches/moda.png';
import culinariaIcon from '@/assets/niches/culinaria.png';
import lifestyleIcon from '@/assets/niches/lifestyle.png';
import viagemIcon from '@/assets/niches/viagem.png';
import petsIcon from '@/assets/niches/pets.png';
import educacaoIcon from '@/assets/niches/educacao.png';
import negociosIcon from '@/assets/niches/negocios.png';
import saudeMentalIcon from '@/assets/niches/saude-mental.png';
import vidaRealIcon from '@/assets/niches/vida-real.png';

const nicheIcons: Record<string, string> = {
  fitness: fitnessIcon,
  beleza: belezaIcon,
  moda: modaIcon,
  culinaria: culinariaIcon,
  lifestyle: lifestyleIcon,
  viagem: viagemIcon,
  pets: petsIcon,
  educacao: educacaoIcon,
  negocios: negociosIcon,
  'saude-mental': saudeMentalIcon,
  'vida-real': vidaRealIcon,
};

interface NicheIconProps {
  id: string;
  fallbackEmoji?: string;
  size?: number;
  className?: string;
}

export function NicheIcon({ id, fallbackEmoji, size = 24, className = '' }: NicheIconProps) {
  const icon = nicheIcons[id];

  if (icon) {
    return <img src={icon} alt={id} width={size} height={size} className={`inline-block object-contain ${className}`} />;
  }

  return <span className={className}>{fallbackEmoji || '📌'}</span>;
}

/** Check if a niche has a custom icon image */
export function hasNicheIcon(id: string): boolean {
  return id in nicheIcons;
}

/** Get the icon URL if available */
export function getNicheIconUrl(id: string): string | null {
  return nicheIcons[id] || null;
}
