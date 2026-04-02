import { useMemo } from 'react';

const IN_APP_PATTERNS = [
  'Instagram',
  'FBAN',
  'FBAV',
  'Twitter',
  'Line/',
  'TikTok',
  'BytedanceWebview',
  'Snapchat',
  'Pinterest',
  'LinkedIn',
];

export function useInAppBrowser() {
  return useMemo(() => {
    const ua = navigator.userAgent || '';
    const isInApp = IN_APP_PATTERNS.some((p) => ua.includes(p));
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    return { isInApp, isIOS, isAndroid };
  }, []);
}
