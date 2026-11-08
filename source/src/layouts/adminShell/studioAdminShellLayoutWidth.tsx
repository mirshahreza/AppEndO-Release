import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DesignerDocument } from '../../domain/component-designer/types';
import { componentDesignerQueryKeys, loadDesignerShellDraft } from '../../shared/api/queries/component-designer';
import {
  APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT,
  resolveAppShellLayoutDocument,
} from '../../shared/lib/appShellLayoutWidthDefaults';
import { resolveAppShellLayoutDraftKey } from '../../shared/lib/resolveAppShellLayoutDraftKey';
import { ShellLayoutWidthProvider } from '../../shared/ui/shell-foundation/ShellLayoutWidthContext';
import { AdminShellLayoutWidthFrame } from '../appShell/AdminShellLayoutWidthFrame';

/** Stable session key for studio admin chrome (culture-independent). */
export const STUDIO_ADMIN_SHELL_LAYOUT_SESSION_KEY = 'studio-admin-chrome';

export type StudioAdminShellLayoutWidthProviderProps = {
  portal: { portalSegment?: string; shellKey?: string } | null | undefined;
  children: React.ReactNode;
};

/**
 * Single layout-width provider for `AdminLayout` — mounts synchronously with fallback metadata
 * so header controls work in RTL/LTR before the portal-layout draft fetch completes.
 */
export const StudioAdminShellLayoutWidthProvider: React.FC<StudioAdminShellLayoutWidthProviderProps> = ({
  portal,
  children,
}) => {
  const layoutDraftKey = resolveAppShellLayoutDraftKey(portal);
  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.publishedShell(layoutDraftKey),
    queryFn: () => loadDesignerShellDraft(layoutDraftKey),
    enabled: layoutDraftKey.length > 0,
    staleTime: 60_000,
  });

  const document = React.useMemo<DesignerDocument>(() => (
    resolveAppShellLayoutDocument(draftQuery.data?.document, true)
  ), [draftQuery.data?.document]);

  const shellKey = layoutDraftKey.trim() || STUDIO_ADMIN_SHELL_LAYOUT_SESSION_KEY;

  return (
    <ShellLayoutWidthProvider document={document} shellKey={shellKey} appShellChrome>
      <AdminShellLayoutWidthFrame className="min-h-dvh w-full">
        {children}
      </AdminShellLayoutWidthFrame>
    </ShellLayoutWidthProvider>
  );
};

export { APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT };
