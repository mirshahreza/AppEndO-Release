import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import '../../../shared/ui/site-shell.css';
import { AppRouteLoading } from '../../../components/AppRouteLoading';
import type { DesignerBindingDefinitions } from '../../../domain/component-designer/types';
import { createDefaultBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { buildShellRuntimeSlotsFromDocument } from '../../../app/platform/buildShellRuntimeSlots';
import {
  DesignerPublishedShellChromeProvider,
  useDesignerPublishedShellMobileMenuOpen,
  useDesignerPublishedShellSidebarCollapsed,
} from '../../../app/platform/DesignerPublishedShellChrome';
import { componentDesignerQueryKeys, loadDesignerShellDraft } from '../../../shared/api/queries/component-designer';
import { SHELL_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import { ensureShellContentOutletFlex } from '../../../shared/lib/ensureShellContentOutletFlex';
import { ensureShellSideNavFillHeight } from '../../../shared/lib/ensureShellSideNavFillHeight';
import { ensureShellSidebarCollapsedChrome } from '../../../shared/lib/ensureShellSidebarCollapsedChrome';
import { ensureShellRouteOutletSlot } from '../../../shared/lib/shellRouteOutlet';
import { PortalShellLayoutWidthProvider } from '../../../app/platform/PortalShellLayoutWidthProvider';
import { DesignerDocumentShellRenderer } from '../../../shared/ui/shell-runtime';
import { cn } from '../../../lib/utils';

export type DesignerPreviewPortalShellProps = {
  shellKey: string;
  routeOutlet: React.ReactNode;
  className?: string;
  /** Live canvas uses content-only chrome; preview dialog keeps the full shell sidebar. */
  shellChrome?: 'full' | 'content-only';
};

const DesignerPreviewPortalShellViewport: React.FC<{
  shellKey: string;
  preparedDocument: NonNullable<ReturnType<typeof ensureShellRouteOutletSlot>>;
  bindingDefinitions: DesignerBindingDefinitions;
  routeOutlet: React.ReactNode;
  className?: string;
  shellChrome?: 'full' | 'content-only';
}> = ({ shellKey, preparedDocument, bindingDefinitions, routeOutlet, className, shellChrome = 'full' }) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isSidebarCollapsed = useDesignerPublishedShellSidebarCollapsed();
  const mobileNavigationOpen = useDesignerPublishedShellMobileMenuOpen();

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    root.style.setProperty(
      '--designer-shell-sidebar-width',
      isSidebarCollapsed ? 'var(--admin-shell-sidebar-width-collapsed, 81px)' : 'var(--admin-shell-sidebar-width, 250px)',
    );
    root.dataset.sidebarCollapsed = isSidebarCollapsed ? 'true' : 'false';
  }, [isSidebarCollapsed]);

  const runtimeSlots = React.useMemo(
    () => buildShellRuntimeSlotsFromDocument(preparedDocument, { routeOutlet }),
    [preparedDocument, routeOutlet],
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        className ?? 'h-full min-h-0 w-full overflow-hidden',
        shellChrome === 'content-only' && [
          'designer-preview-portal-shell--content-only',
          '[&_.designer-shell-sidebar]:hidden',
          '[&_.h-screen]:!h-full',
        ],
      )}
      data-testid="designer-preview-portal-shell"
      data-shell-key={shellKey}
      data-shell-chrome={shellChrome}
    >
      <DesignerDocumentShellRenderer
        document={preparedDocument}
        bindingDefinitions={bindingDefinitions}
        runtimeSlots={runtimeSlots}
        mobileNavigationOpen={mobileNavigationOpen}
      />
    </div>
  );
};

export const DesignerPreviewPortalShell: React.FC<DesignerPreviewPortalShellProps> = ({
  shellKey,
  routeOutlet,
  className,
  shellChrome = 'full',
}) => {
  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.publishedShell(shellKey),
    queryFn: () => loadDesignerShellDraft(shellKey),
    enabled: shellKey.trim().length > 0,
  });

  const preparedDocument = React.useMemo(
    () => (draftQuery.data?.document
      ? ensureShellSidebarCollapsedChrome(
        ensureShellSideNavFillHeight(
          ensureShellContentOutletFlex(ensureShellRouteOutletSlot(draftQuery.data.document)),
        ),
      )
      : null),
    [draftQuery.data?.document],
  );

  if (draftQuery.isLoading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <AppRouteLoading />
      </div>
    );
  }

  if (draftQuery.isError || !draftQuery.data || !preparedDocument) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        Portal shell <span className="font-semibold">{SHELL_DRAFT_FOLDER}/{shellKey}</span> is not available.
      </div>
    );
  }

  return (
    <DesignerPublishedShellChromeProvider>
      <PortalShellLayoutWidthProvider shellKey={shellKey} documentOverride={preparedDocument}>
        <DesignerPreviewPortalShellViewport
          shellKey={shellKey}
          preparedDocument={preparedDocument}
          bindingDefinitions={draftQuery.data.bindingDefinitions ?? createDefaultBindingDefinitions()}
          routeOutlet={routeOutlet}
          className={className}
          shellChrome={shellChrome}
        />
      </PortalShellLayoutWidthProvider>
    </DesignerPublishedShellChromeProvider>
  );
};
