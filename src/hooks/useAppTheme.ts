import { useEffect, useState, useCallback } from 'react';

const KEY = 'influlab.theme';
type Theme = 'light' | 'dark';

function read(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('landing-dark');
  else root.classList.remove('landing-dark');
}

// Aplica imediatamente no load (evita flash)
if (typeof window !== 'undefined') apply(read());

export function useAppTheme() {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch {}
    // notifica outras instâncias do hook
    window.dispatchEvent(new CustomEvent('influlab:theme', { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      if (t && t !== theme) setThemeState(t);
    };
    window.addEventListener('influlab:theme', onChange as EventListener);
    return () => window.removeEventListener('influlab:theme', onChange as EventListener);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggle, isDark: theme === 'dark' };
}
