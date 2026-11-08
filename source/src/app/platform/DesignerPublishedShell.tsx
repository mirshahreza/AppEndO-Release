import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import '../../shared/ui/site-shell.css';
import { SITE_SHELL_LAYOUT_KEY, STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { loadDesignerShellDraft, componentDesignerQueryKeys } from '../../shared/api/queries/component-designer';
import { isSystemManagedShellLayoutKey } from '../../shared/lib/designerShellEntry';
import { SHELL_DRAFT_FOLDER } from '../../shared/lib/designerShellEntry';
import { ensureSiteShellHeaderControls } from '../../shared/lib/ensureSiteShellHeaderControls';
import { ensureShellContentOutletFlex } from '../../shared/lib/ensureShellContentOutletFlex';
import { ensureShellSideNavFillHeight } from '../../shared/lib/ensureShellSideNavFillHeight';
import { ensureShellAdminRootChrome } from '../../shared/lib/ensureShellAdminRootChrome';
import { ensureShellSidebarCollapsedChrome } from '../../shared/lib/ensureShellSidebarCollapsedChrome';
import { ensureShellRouteOutletSlot } from '../../shared/lib/shellRouteOutlet';
import { DEFAULT_PWA_SETTINGS, resolvePwaFaviconUrl } from '../../shared/api/contracts/settings/pwa';
import { usePwaConfigQuery } from '../../shared/api/queries/pwa';
import { resolveAppShellLayoutDocument } from '../../shared/lib/appShellLayoutWidthDefaults';
import { ShellLayoutWidthProvider } from '../../shared/ui/shell-foundation/ShellLayoutWidthContext';
import { ShellExperienceProvider } from '../../contexts/ShellExperienceContext';
import { UserShellExperienceBridge } from '../../contexts/UserShellExperienceBridge';
import { useOptionalPlatformMount } from './PlatformMountContext';
import { usePlatformConfig } from './PlatformConfigProvider';
import { getShellByKey } from './platformConfigHelpers';
import { DesignerDocumentShellRenderer } from '../../shared/ui/shell-runtime';
import { buildShellRuntimeSlotsFromDocument } from './buildShellRuntimeSlots';
import { ShellRouteOutlet } from './ShellRouteOutlet';
import {
  DesignerPublishedShellChromeProvider,
  useDesignerPublishedShellMobileMenuOpen,
  useDesignerPublishedShellDirection,
  useDesignerPublishedShellSidebarCollapsed,
} from './DesignerPublishedShellChrome';

export type DesignerPublishedShellProps = {
  shellKey: string;
  publishedVersion?: number | null;
};

export function createDesignerPublishedShellComponent(
  shellKey: string,
  publishedVersion?: number | null,
): React.FC {
  const ShellComponent: React.FC = () => (
    <DesignerPublishedShell shellKey={shellKey} publishedVersion={publishedVersion} />
  );
  ShellComponent.displayName = `DesignerPublishedShell(${shellKey}${publishedVersion ? `@v${publishedVersion}` : ''})`;
  return ShellComponent;
}

const DesignerPublishedShellViewport: React.FC<{
  shellKey: string;
  preparedDocument: NonNullable<ReturnType<typeof ensureShellRouteOutletSlot>>;
  bindingDefinitions: Record<string, unknown>;
}> = ({ shellKey, preparedDocument, bindingDefinitions }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const isSidebarCollapsed = useDesignerPublishedShellSidebarCollapsed();
  const shellDirection = useDesignerPublishedShellDirection();
  const mobileNavigationOpen = useDesignerPublishedShellMobileMenuOpen();
  const pwaQuery = usePwaConfigQuery();
  const pwaConfig = pwaQuery.data ?? DEFAULT_PWA_SETTINGS;

  const rootNode = preparedDocument.nodes[preparedDocument.rootNodeId];
  const favicon = rootNode?.props?.favicon;
  const fontFamily = rootNode?.props?.fontFamily;
  const resolvedFavicon = typeof favicon === 'string' && favicon.trim().length > 0
    ? favicon.trim()
    : resolvePwaFaviconUrl(pwaConfig);

  useEffect(() => {
    let link = document.querySelector("link[rel='icon'][sizes='32x32']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.sizes = '32x32';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    link.href = resolvedFavicon;
  }, [resolvedFavicon]);

  useEffect(() => {
    const root = rootRef.current;
    if (typeof fontFamily === 'string' && fontFamily.trim().length > 0) {
      root?.style.setProperty('--app-font-family', fontFamily.trim());
      document.documentElement.style.setProperty('--app-font-family', fontFamily.trim());
    } else {
      root?.style.removeProperty('--app-font-family');
      document.documentElement.style.removeProperty('--app-font-family');
    }
    return () => {
      document.documentElement.style.removeProperty('--app-font-family');
    };
  }, [fontFamily]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    root.style.setProperty(
      '--designer-shell-sidebar-width',
      isSidebarCollapsed ? 'var(--admin-shell-sidebar-width-collapsed, 81px)' : 'var(--admin-shell-sidebar-width, 250px)',
    );

    const shellRoot = root.querySelector<HTMLElement>('[data-admin-shell-root]')
      ?? root.querySelector<HTMLElement>('.admin-shell-surface.shell-atmosphere');
    const collapsedTarget = shellRoot ?? root;
    collapsedTarget.dataset.sidebarCollapsed = isSidebarCollapsed ? 'true' : 'false';
    if (shellRoot) {
      shellRoot.dir = shellDirection;
      root.removeAttribute('data-sidebar-collapsed');
    }
  }, [isSidebarCollapsed, shellDirection]);

  const routeOutlet = useMemo(() => <ShellRouteOutlet />, []);
  const runtimeSlots = useMemo(
    () => buildShellRuntimeSlotsFromDocument(preparedDocument, { routeOutlet }),
    [preparedDocument, routeOutlet],
  );
  const isDocumentFlowShell = shellKey.trim() === SITE_SHELL_LAYOUT_KEY
    || Object.values(preparedDocument.nodes).some((node) => {
      const className = typeof node.props.className === 'string' ? node.props.className : '';
      return className.split(/\s+/).includes('site-shell');
    });

  return (
    <div
      ref={rootRef}
      className={isDocumentFlowShell ? 'h-screen w-full overflow-y-auto' : 'h-screen w-full overflow-hidden'}
      data-testid="designer-published-shell"
      data-shell-key={shellKey}
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

export const DesignerPublishedShell: React.FC<DesignerPublishedShellProps> = ({
  shellKey,
  publishedVersion,
}) => {
  const { config } = usePlatformConfig();
  const registryShell = getShellByKey(config, shellKey);
  const isStudioAdminSurface = registryShell?.surface === 'studio';
  const isSystemManagedShell = isSystemManagedShellLayoutKey(shellKey);

  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.publishedShell(shellKey, publishedVersion),
    queryFn: () => loadDesignerShellDraft(shellKey, publishedVersion),
    enabled: shellKey.trim().length > 0 && !isSystemManagedShell,
  });

  const preparedDocument = useMemo(
    () => (draftQuery.data?.document
      ? ensureSiteShellHeaderControls(
        ensureShellAdminRootChrome(
          ensureShellSidebarCollapsedChrome(
            ensureShellSideNavFillHeight(
              ensureShellContentOutletFlex(
                ensureShellRouteOutletSlot(draftQuery.data.document),
              ),
            ),
          ),
        ),
        shellKey,
      )
      : null),
    [draftQuery.data?.document, shellKey],
  );

  const layoutWidthDocument = useMemo(
    () => (preparedDocument
      ? resolveAppShellLayoutDocument(preparedDocument, isStudioAdminSurface)
      : null),
    [isStudioAdminSurface, preparedDocument],
  );

  if (isSystemManagedShell) {
    return (
      <div
        className="h-screen w-full overflow-hidden bg-white"
        data-testid="designer-published-shell"
        data-shell-key={shellKey}
      >
        <ShellRouteOutlet />
      </div>
    );
  }

  if (draftQuery.isLoading) {
    return <AppRouteLoading />;
  }

  if (draftQuery.isError || !draftQuery.data || !preparedDocument || !layoutWidthDocument) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Shell layout <span className="font-semibold">{SHELL_DRAFT_FOLDER}/{shellKey}</span> is not available.
        </div>
      </div>
    );
  }

  return (
    <DesignerPublishedShellAppearanceHost>
      <ShellLayoutWidthProvider
        document={layoutWidthDocument}
        shellKey={shellKey}
        appShellChrome={isStudioAdminSurface}
      >
        <DesignerPublishedShellChromeProvider>
          <DesignerPublishedShellViewport
            shellKey={shellKey}
            preparedDocument={preparedDocument}
            bindingDefinitions={draftQuery.data.bindingDefinitions ?? {}}
          />
        </DesignerPublishedShellChromeProvider>
      </ShellLayoutWidthProvider>
    </DesignerPublishedShellAppearanceHost>
  );
};

const DesignerPublishedShellAppearanceHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mountId = useOptionalPlatformMount()?.id ?? STUDIO_MOUNT_ID;
  return (
    <ShellExperienceProvider mountId={mountId}>
      <UserShellExperienceBridge />
      {children}
    </ShellExperienceProvider>
  );
};
