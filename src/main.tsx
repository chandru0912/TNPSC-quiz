import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA Service Worker safely in production; in local dev, unregister any stale SW
// so Vite HMR dynamic imports (e.g. /src/pages/Admin.tsx?t=...) are never intercepted.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('PWA Service Worker registered with scope:', registration.scope);
      }).catch((error) => {
        console.warn('PWA Service Worker registration failed:', error);
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        void reg.unregister();
      });
    }).catch(() => {});
  }
}
