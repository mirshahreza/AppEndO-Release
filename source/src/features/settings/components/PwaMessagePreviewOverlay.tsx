import React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Smartphone, X } from 'lucide-react';
import type { PwaSettings } from '../../../shared/api/contracts/settings/pwa';
import { resolvePwaIcon192Url } from '../../../shared/api/contracts/settings/pwa';
import { AppButton } from '../../../shared/ui';
import { cn } from '../../../lib/utils';

export type PwaMessagePreviewKind = 'install-prompt' | 'install-ready' | 'update-available';

type PwaMessagePreviewOverlayProps = {
  kind: PwaMessagePreviewKind | null;
  pwa: PwaSettings;
  onClose: () => void;
};

export const PwaMessagePreviewOverlay: React.FC<PwaMessagePreviewOverlayProps> = ({
  kind,
  pwa,
  onClose,
}) => {
  React.useEffect(() => {
    if (!kind) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [kind, onClose]);

  if (!kind || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" onClick={onClose} role="presentation">
      {kind === 'install-ready' ? (
        <div
          role="status"
          aria-live="polite"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'fixed z-[81] top-4 left-1/2 -translate-x-1/2',
            'flex flex-wrap items-center gap-2.5 min-w-[280px] max-w-lg px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border',
            'bg-emerald-50 border-emerald-200 text-emerald-800',
          )}
        >
          <Smartphone className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="min-w-0 flex-1 leading-snug">
            {pwa.installReadyMessage || 'Ready to install message'}
          </span>
          {pwa.showInstallPrompt ? (
            <AppButton intent="primary" size="sm" type="button">
              {pwa.installButtonLabel || 'Install'}
            </AppButton>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
            aria-label="Dismiss install ready notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {kind === 'update-available' ? (
        <div
          role="status"
          aria-live="polite"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'fixed z-[81] bottom-4 left-1/2 -translate-x-1/2',
            'flex flex-wrap items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border',
            'bg-white border-slate-200 text-slate-800',
          )}
        >
          <RefreshCw className="h-5 w-5 shrink-0 text-primary-500" aria-hidden="true" />
          <span>{pwa.updateAvailableMessage || 'Update available message'}</span>
          <AppButton intent="primary" size="sm" type="button">
            {pwa.updateButtonLabel || 'Reload'}
          </AppButton>
        </div>
      ) : null}

      {kind === 'install-prompt' ? (
        <div
          role="dialog"
          aria-labelledby="pwa-install-preview-title"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'fixed z-[81] bottom-4 left-1/2 -translate-x-1/2 w-[min(100%-2rem,420px)]',
            'rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl',
          )}
        >
          <div className="flex items-start gap-3">
            <img
              src={resolvePwaIcon192Url(pwa)}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-100"
            />
            <div className="min-w-0 flex-1">
              <div id="pwa-install-preview-title" className="text-sm font-bold text-slate-900">
                {pwa.installPromptTitle || 'Install prompt title'}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {pwa.installPromptMessage || 'Install prompt message'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AppButton intent="primary" size="sm" type="button">
                  {pwa.installButtonLabel || 'Install'}
                </AppButton>
                <AppButton intent="cancel" size="sm" type="button" onClick={onClose}>
                  {pwa.dismissButtonLabel || 'Dismiss'}
                </AppButton>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
};
