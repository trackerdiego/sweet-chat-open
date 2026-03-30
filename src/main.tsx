import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
      .then((reg) => console.log('[app] SW registered:', reg.scope))
      .catch((err) => console.error('[app] SW registration failed:', err));
  });
}
