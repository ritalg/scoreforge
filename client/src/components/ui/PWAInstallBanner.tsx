import { useEffect, useState } from 'react';

// @ts-ignore — virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PWAInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed] = useState(() => localStorage.getItem('pwa-install-dismissed') === '1');

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      r && setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const deferredPrompt = e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      setInstallPrompt(deferredPrompt);
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  }

  function dismiss() {
    setShowInstall(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  }

  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-sm max-w-sm">
        <span>A new version is available</span>
        <button onClick={() => updateServiceWorker(true)}
          className="px-3 py-1 bg-brand-500 rounded-lg text-xs hover:bg-brand-400">
          Refresh
        </button>
      </div>
    );
  }

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-sm max-w-sm">
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white">Install ScoreForge</p>
        <p className="text-xs text-gray-500">Study offline, anytime</p>
      </div>
      <button onClick={install}
        className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700">
        Install
      </button>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
    </div>
  );
}
