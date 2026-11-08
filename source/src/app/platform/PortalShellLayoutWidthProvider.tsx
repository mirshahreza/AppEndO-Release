import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DesignerDocument } from '../../domain/component-designer/types';
import { componentDesignerQueryKeys, loadDesignerShellDraft } from '../../shared/api/queries/component-designer';
import { resolveAppShellLayoutDocument } from '../../shared/lib/appShellLayoutWidthDefaults';
import { ShellLayoutWidthProvider } from '../../shared/ui/shell-foundation/ShellLayoutWidthContext';

export type PortalShellLayoutWidthProviderProps = {
  /** Published layout draft key (e.g. `studio-shell`, `hawiety`). */
  shellKey?: string | null;
  /** Live Designer uses the in-memory document instead of the published draft. */
  documentOverride?: DesignerDocument | null;
  /** Studio `core:AppShell` — bounded header control until the layout draft opts out in metadata. */
  appShellChrome?: boolean;
  children: React.ReactNode;
};

export const PortalShellLayoutWidthProvider: React.FC<PortalShellLayoutWidthProviderProps> = ({
  shellKey,
  documentOverride = null,
  appShellChrome = false,
  children,
}) => {
  const resolvedKey = shellKey?.trim() ?? '';
  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.publishedShell(resolvedKey),
    queryFn: () => loadDesignerShellDraft(resolvedKey),
    enabled: !documentOverride && resolvedKey.length > 0,
    staleTime: 60_000,
  });

  const loadedDocument = documentOverride ?? draftQuery.data?.document ?? null;
  const document = React.useMemo(
    () => resolveAppShellLayoutDocument(loadedDocument, appShellChrome),
    [appShellChrome, loadedDocument],
  );
  const providerKey = documentOverride
    ? (resolvedKey || documentOverride.id)
    : (resolvedKey || document.id);
  const shellSessionKey = providerKey.trim() || (appShellChrome ? 'app-shell' : '');

  if (!appShellChrome && !loadedDocument && !documentOverride) {
    return <>{children}</>;
  }

  if (!shellSessionKey) {
    return <>{children}</>;
  }

  return (
    <ShellLayoutWidthProvider document={document} shellKey={shellSessionKey} appShellChrome={appShellChrome}>
      {children}
    </ShellLayoutWidthProvider>
  );
};
