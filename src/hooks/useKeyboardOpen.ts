import { useEffect, useState } from 'react';

/**
 * Detecta se o teclado virtual está aberto (mobile).
 * Usa visualViewport quando disponível (iOS/Android modernos).
 * Retorna true quando a diferença entre layoutViewport e visualViewport
 * excede ~150px (typical keyboard height).
 */
export function useKeyboardOpen(threshold = 150): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const check = () => {
      const diff = window.innerHeight - vv.height;
      setOpen(diff > threshold);
    };

    check();
    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', check);
    return () => {
      vv.removeEventListener('resize', check);
      vv.removeEventListener('scroll', check);
    };
  }, [threshold]);

  return open;
}
