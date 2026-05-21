import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Fundo padrão das telas internas: orbs neon no modo dark, limpo no light.
 * Use junto com um wrapper `relative overflow-hidden` e coloque o conteúdo
 * dentro de um container com `relative z-10`.
 */
export function PageBackdrop() {
  const { isDark } = useAppTheme();
  if (!isDark) return null;
  return (
    <>
      <div className="app-neon-orb" style={{ width: 460, height: 460, background: 'hsl(270 95% 60%)', top: -180, left: -160 }} />
      <div className="app-neon-orb" style={{ width: 360, height: 360, background: 'hsl(322 90% 60%)', top: 240, right: -140 }} />
      <div className="app-neon-orb" style={{ width: 300, height: 300, background: 'hsl(258 85% 55%)', bottom: -100, left: -80, opacity: 0.3 }} />
    </>
  );
}
