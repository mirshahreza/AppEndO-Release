import { useLayoutEffect } from 'react';
import {
  formatAdminShellBrowserDocumentTitle,
  type AdminShellDocumentTitleModule,
} from './adminShellDocumentTitle';

export type UseAdminShellDocumentTitleInput = {
  module: AdminShellDocumentTitleModule;
  fallbackLabel: string;
  portalWindowTitle?: string | null;
  pageTitleReady?: boolean;
  enabled?: boolean;
};

/** Keeps `document.title` in sync with the resolved admin shell header for the active route. */
export function useAdminShellDocumentTitle(input: UseAdminShellDocumentTitleInput): void {
  const {
    module,
    fallbackLabel,
    portalWindowTitle,
    pageTitleReady = true,
    enabled = true,
  } = input;

  const titleTrailKey = module.titleTrail?.join('\u0000') ?? '';

  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return;
    }
    const next = formatAdminShellBrowserDocumentTitle({
      module,
      fallbackLabel,
      portalWindowTitle,
      pageTitleReady,
    });
    if (next) {
      document.title = next;
    }
  }, [
    enabled,
    fallbackLabel,
    module.groupLabel,
    module.label,
    pageTitleReady,
    portalWindowTitle,
    titleTrailKey,
  ]);
}
