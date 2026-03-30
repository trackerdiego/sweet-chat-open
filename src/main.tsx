import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreview = window.location.hostname.includes('id-preview--') ||
    window.location.hostname.includes('lovableproject.com');

  if (!isInIframe && !isPreview) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
        .then((reg) => console.log('[app] SW registered:', reg.scope))
        .catch((err) => console.error('[app] SW registration failed:', err));
    });
  } else {
    console.log('[app] Preview/iframe detected — skipping SW registration');
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
  }
}
