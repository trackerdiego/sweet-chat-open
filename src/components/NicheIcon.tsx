// NicheIcon - displays niche-specific icons with fallback to emoji
interface NicheIconProps {
  id: string;
  fallbackEmoji?: string;
  size?: number;
  className?: string;
}

export function NicheIcon({ id, fallbackEmoji, size = 24, className = '' }: NicheIconProps) {
  // For now, use emoji fallback since asset images need to be copied separately
  return <span className={className} style={{ fontSize: size * 0.75 }}>{fallbackEmoji || '📌'}</span>;
}

export function hasNicheIcon(id: string): boolean {
  return false;
}

export function getNicheIconUrl(id: string): string | null {
  return null;
}
