'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Enregistrement du Service Worker + prompt d'installation
// (Pack 4 — Croissance & Rétention)
//
// - Enregistre /sw.js UNIQUEMENT en production.
// - Capture `beforeinstallprompt` pour proposer un bouton discret
//   « Installer l’appli ».
//
// Le composant principal doit monter <PwaRegister /> dans layout.tsx.
// ─────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Hook réutilisable : expose le prompt d'installation PWA. */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') setIsInstalled(true);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}

/**
 * À monter UNE FOIS dans layout.tsx :
 *   import PwaRegister from '@/components/shared/pwa-register';
 *   <PwaRegister />
 */
export default function PwaRegister() {
  const { canInstall, promptInstall } = useInstallPrompt();

  // Enregistrement du service worker (production uniquement)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Échec silencieux : la PWA ne doit jamais casser l'app
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  if (!canInstall) return null;

  return (
    <Button
      onClick={promptInstall}
      size="sm"
      className="no-print fixed bottom-4 right-4 z-40 h-11 gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 text-xs font-medium text-sky-300 shadow-lg backdrop-blur hover:bg-sky-500/20"
      aria-label="Installer l’application DONCIEL TM"
    >
      <Smartphone className="size-4" />
      <span>Installer l’appli</span>
    </Button>
  );
}
