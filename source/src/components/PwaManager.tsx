import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isPortalOwnedDocumentChrome } from '../shared/lib/portalDocumentChrome';
import { RefreshCwIcon, SmartphoneIcon, XIcon } from './pwaIcons';
import { AppButton } from '../shared/ui/AppButton';
import { DEFAULT_PWA_SETTINGS, resolvePwaIcon192Url } from '../shared/api/contracts/settings/pwa';
import { applyPwaDocumentMeta, usePwaConfigQuery } from '../shared/api/queries/pwa';
import { cn } from '../lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALL_DISMISS_KEY = 'appendo-pwa-install-dismissed';

const isStandaloneDisplay = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches
    || ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
};

export const PwaManager: React.FC = () => {
  const pwaQuery = usePwaConfigQuery();
  const config = pwaQuery.data ?? DEFAULT_PWA_SETTINGS;
  const [pathname, setPathname] = React.useState(
    () => (typeof window !== 'undefined' ? window.location.pathname : '/'),
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncPathname = () => {
      setPathname(window.location.pathname);
    };

    syncPathname();
    window.addEventListener('popstate', syncPathname);
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (...args) => {
      originalPushState(...args);
      syncPathname();
    };
    window.history.replaceState = (...args) => {
      originalReplaceState(...args);
      syncPathname();
    };

    return () => {
      window.removeEventListener('popstate', syncPathname);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = React.useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(INSTALL_DISMISS_KEY) === '1',
  );
  const [installReady, setInstallReady] = React.useState(false);
  const [needRefresh, setNeedRefresh] = React.useState(false);
  const updateServiceWorkerRef = React.useRef<(() => Promise<void>) | undefined>(undefined);

  React.useEffect(() => {
    if (isPortalOwnedDocumentChrome(pathname)) {
      return;
    }
    applyPwaDocumentMeta(config);
  }, [config, pathname]);

  React.useEffect(() => {
    if (!config.enabled) {
      return;
    }

    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onOfflineReady() {
        setInstallReady(true);
        window.setTimeout(() => setInstallReady(false), 8000);
      },
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
  }, [config.enabled]);

  React.useEffect(() => {
    if (!config.enabled || !config.showInstallPrompt) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [config.enabled, config.showInstallPrompt]);

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
    }
  };

  const dismissInstall = () => {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setInstallDismissed(true);
    setInstallEvent(null);
  };

  const dismissInstallReady = () => {
    setInstallReady(false);
  };

  const handleRefresh = async () => {
    await updateServiceWorkerRef.current?.();
    setNeedRefresh(false);
  };

  if (!config.enabled) {
    return null;
  }

  const showInstallBanner = config.showInstallPrompt
    && Boolean(installEvent)
    && !installDismissed
    && !isStandaloneDisplay();

  const showInstallReadyBanner = installReady
    && !isStandaloneDisplay()
    && !showInstallBanner;

  return (
    <>
      {showInstallReadyBanner && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'fixed z-[75] top-4 left-1/2 -translate-x-1/2',
            'flex flex-wrap items-center gap-2.5 min-w-[280px] max-w-lg px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border',
            'bg-emerald-50 border-emerald-200 text-emerald-800',
          )}
        >
          <SmartphoneIcon className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 leading-snug">{config.installReadyMessage}</span>
          {config.showInstallPrompt && installEvent ? (
            <AppButton intent="primary" size="sm" onClick={handleInstall}>
              {config.installButtonLabel}
            </AppButton>
          ) : null}
          <button
            type="button"
            onClick={dismissInstallReady}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
            aria-label="Dismiss install ready notice"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'fixed z-[75] bottom-4 left-1/2 -translate-x-1/2',
            'flex flex-wrap items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border',
            'bg-white border-slate-200 text-slate-800',
          )}
        >
          <RefreshCwIcon className="h-5 w-5 shrink-0 text-primary-500" />
          <span>{config.updateAvailableMessage}</span>
          <AppButton intent="primary" size="sm" onClick={handleRefresh}>
            {config.updateButtonLabel}
          </AppButton>
        </div>
      )}

      {showInstallBanner && (
        <div
          role="dialog"
          aria-labelledby="pwa-install-title"
          className={cn(
            'fixed z-[75] bottom-4 left-1/2 -translate-x-1/2 w-[min(100%-2rem,420px)]',
            'rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl',
          )}
        >
          <div className="flex items-start gap-3">
            <img
              src={resolvePwaIcon192Url(config)}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-100"
            />
            <div className="min-w-0 flex-1">
              <div id="pwa-install-title" className="text-sm font-bold text-slate-900">
                {config.installPromptTitle}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {config.installPromptMessage}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AppButton intent="primary" size="sm" onClick={handleInstall}>
                  {config.installButtonLabel}
                </AppButton>
                <AppButton intent="cancel" size="sm" onClick={dismissInstall}>
                  {config.dismissButtonLabel}
                </AppButton>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissInstall}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss install prompt"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
