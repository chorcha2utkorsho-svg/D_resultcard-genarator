import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __dlikonDeferredPrompt?: BeforeInstallPromptEvent | null;
    __dlikonPwaInstalled?: boolean;
  }
}

let sharedDeferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? window.__dlikonDeferredPrompt || null : null;
let sharedIsInstalled =
  typeof window !== 'undefined'
    ? Boolean(
        window.__dlikonPwaInstalled ||
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true
      )
    : false;

const subscribers = new Set<() => void>();
let listenersAttached = false;

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function ensureGlobalListeners() {
  if (typeof window === 'undefined' || listenersAttached) return;
  listenersAttached = true;

  if (window.__dlikonDeferredPrompt && !sharedDeferredPrompt) {
    sharedDeferredPrompt = window.__dlikonDeferredPrompt;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    window.__dlikonDeferredPrompt = sharedDeferredPrompt;
    notifySubscribers();
  });

  window.addEventListener('dlikon-pwa-prompt-ready', () => {
    if (window.__dlikonDeferredPrompt) {
      sharedDeferredPrompt = window.__dlikonDeferredPrompt;
      notifySubscribers();
    }
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    window.__dlikonDeferredPrompt = null;
    window.__dlikonPwaInstalled = true;
    notifySubscribers();
  });

  window.addEventListener('dlikon-pwa-installed', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifySubscribers();
  });
}

ensureGlobalListeners();

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    ensureGlobalListeners();
    return (
      sharedDeferredPrompt ||
      (typeof window !== 'undefined' ? window.__dlikonDeferredPrompt || null : null)
    );
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => sharedIsInstalled);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    ensureGlobalListeners();

    const syncState = () => {
      const standalone =
        sharedIsInstalled ||
        Boolean(window.__dlikonPwaInstalled) ||
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
      setDeferredPrompt(sharedDeferredPrompt || window.__dlikonDeferredPrompt || null);
    };

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    syncState();
    subscribers.add(syncState);

    return () => {
      subscribers.delete(syncState);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent =
      deferredPrompt ||
      sharedDeferredPrompt ||
      (typeof window !== 'undefined' ? window.__dlikonDeferredPrompt || null : null);

    if (!promptEvent) return false;

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        sharedIsInstalled = true;
        sharedDeferredPrompt = null;
        if (typeof window !== 'undefined') {
          window.__dlikonDeferredPrompt = null;
          window.__dlikonPwaInstalled = true;
        }
        notifySubscribers();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}
