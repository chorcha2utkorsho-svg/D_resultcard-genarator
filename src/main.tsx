import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateSW(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        setInterval(() => {
          void registration.update().catch(() => {});
        }, 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            void registration.update().catch(() => {});
          }
        });
      },
    });
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          void reg.unregister();
        }
      })
      .catch(() => {});
    if ('caches' in window) {
      void caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            if (key.includes('workbox') || key.includes('vite-pwa')) {
              void caches.delete(key);
            }
          }
        })
        .catch(() => {});
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
