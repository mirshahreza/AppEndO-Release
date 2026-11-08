import React, { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AppRouteLoading } from '../components/AppRouteLoading';
import { ShellChromeEnter } from '../shared/ui/shell/ShellChromeEnter';
import { ShellOverlayPortal } from '../shared/ui/shell/ShellOverlayPortal';
import { ShellRouteEnter } from '../shared/ui/shell/ShellRouteEnter';
import { useAuth } from '../contexts/AuthContext';
import { useHomeShortcutFallback } from '../contexts/useHomeShortcutFallback';
import { useCurrentUserDisplay } from '../hooks/useCurrentUserDisplay';
import { ShellExperienceProvider } from '../contexts/ShellExperienceContext';
import { UserShellExperienceBridge } from '../contexts/UserShellExperienceBridge';
import { useOptionalShellExperience } from '../contexts/ShellExperienceContext';
import {
  persistExpandedNavGroups,
  readStoredExpandedNavGroups,
} from '../shared/ui/adminLayoutPreferences';
import { useAdminShellSidebarState } from '../shared/ui/useAdminShellSidebarState';
import { usePersistedAppEndooOpen } from '../shared/ui/shell/usePersistedAppEndooOpen';
import { AboutAppModal } from '../components/AboutAppModal';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_CONTENT_WRAPPER_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_HEADER_INNER_CLASS,
  ADMIN_SHELL_MAIN_CLASS,
  ADMIN_SHELL_MOBILE_BACKDROP_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
} from '../shared/ui/surfaceClasses';
import { APPENDOO_DOCK_LAYOUT_PADDING_CLASS } from '../shared/ui/appendooDock';
import { AtmosphereBackdrop } from '../shared/ui/AtmosphereBackdrop';
import { ShellChromeFinish } from '../shared/ui/ShellChromeFinish';
import {
  resolveAdminShellHeaderContext,
} from './adminShell/buildAdminShellNav';
import { mergeShellHeaderModule } from './adminShell/mergeShellHeaderModule';
import { isAdminShellPageTitleReady } from './adminShell/adminShellDocumentTitle';
import { useAdminShellDocumentTitle } from './adminShell/useAdminShellDocumentTitle';
import {
  ShellHeaderOverrideProvider,
  useShellHeaderOverrideState,
} from './adminShell/ShellHeaderOverrideContext';
import { AdminShellSidebar } from './adminShell/AdminShellSidebar';
import { AdminShellHeader } from './adminShell/AdminShellHeader';
import { TreeNavTwoLevel } from './adminShell/nav/TreeNavTwoLevel';
import { ShellChromeUtilityNav } from './adminShell/nav/ShellChromeUtilityNav';
import { useAdminShellNav } from './adminShell/useAdminShellNav';
import { useOptionalCulture } from '../core/culture/CultureContext';
import { resolveCultureShellIsRtl } from '../core/culture/cultureShellDirection';
import { CULTURE_SHELL_FALLBACK_LABELS } from '../core/culture/cultureShellKeys';
import { PageLoadProfileTracker } from '../features/access-assistant/components/PageLoadProfileTracker';
import { StudioToolsHostProviders } from '../features/access-assistant/components/StudioToolsHostProviders';
import { FeedbackWindowChromeHostProviders } from '../features/feedback/components/FeedbackWindowChromeHostProviders';
import { useStudioToolsGate } from '../features/access-assistant/hooks/useStudioToolsGate';
import { EnsurePlatformMount } from '../app/platform/EnsurePlatformMount';
import { usePlatformConfig } from '../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../app/platform/PlatformMountContext';
import { getMountById, getShellByKey } from '../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID } from '../shared/api/contracts/platform/mountConstants';
import { useOptionalPortal } from '../app/platform/PortalContext';
import { useResolvedPortalBrand } from '../app/platform/usePortalBrand';
import { useShellNavigate } from '../shared/ui/shell/useShellNavigate';
import { PackageSlotRegistryHost } from '../core/packages/PackageSlotRegistryHost';
import { useMobileShellDrawer } from '../shared/lib/useMobileShellDrawer';
import { composeStudioSidebarNav } from '../shared/lib/navTreeFilter';
import { isOverlayNavTier } from '../shared/lib/viewportTokens';
import { useViewportTier } from '../shared/lib/useViewportTier';
import { FeedbackShellFab } from '../features/feedback/components/FeedbackShellFab';
import { overlayMotionBackdropProps } from '../shared/ui/overlay-motion/overlayMotion';
import { isDashboardChromeStrippedView } from '../shared/lib/dashboardCanvas';
import { AdminChromeLayoutWidthHost } from './adminShell/AdminChromeLayoutWidthHost';
import {
  ADMIN_SHELL_SIDEBAR_WIDTH_COLLAPSED_PX,
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
  formatAdminShellSidebarWidthCss,
} from '../shared/ui/adminShellSidebarWidth';

const ProfileDrawer = React.lazy(() =>
  import('../components/ProfileDrawer').then((module) => ({ default: module.ProfileDrawer })),
);

export const AdminLayoutFrame = () => {
  useHomeShortcutFallback();
  const studioToolsGate = useStudioToolsGate();
  const { logout, currentUser } = useAuth();
  const { displayName, avatarXs, avatarInitial, primaryRole } = useCurrentUserDisplay();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateShell = useShellNavigate();
  const [isAiPanelOpen, setIsAiPanelOpen] = usePersistedAppEndooOpen();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isSidebarCollapsed, sidebarCollapsePolicy, setSidebarCollapsed } = useAdminShellSidebarState();
  const shellExperience = useOptionalShellExperience();
  const sidebarExpandedWidthPx = shellExperience?.sidebarExpandedWidthPx
    ?? ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX;
  const [localExpandedGroups, setLocalExpandedGroups] = useState<Set<string>>(
    () => readStoredExpandedNavGroups() ?? new Set(),
  );
  const expandedGroups = shellExperience?.navExpandedGroups ?? localExpandedGroups;
  const setExpandedGroups = shellExperience?.setNavExpandedGroups ?? setLocalExpandedGroups;

  useEffect(() => {
    if (!shellExperience) {
      persistExpandedNavGroups(localExpandedGroups);
    }
  }, [localExpandedGroups, shellExperience]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const navGroups = useAdminShellNav(currentUser);
  const brand = useResolvedPortalBrand();
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id ?? STUDIO_MOUNT_ID;
  const application = useOptionalPortal();
  const shell = application ? getShellByKey(config, application.shellKey) : undefined;
  const NavRenderer = TreeNavTwoLevel;
  const culture = useOptionalCulture();
  const isRtl = resolveCultureShellIsRtl(culture);
  const viewportTier = useViewportTier();
  const overlayNav = isOverlayNavTier(viewportTier);
  const dockedCollapsed = isSidebarCollapsed;
  const desktopNavigationMenu = !overlayNav && dockedCollapsed && sidebarCollapsePolicy === 'hidden';
  const isExperienceMount = getMountById(config, mountId)?.designerRoutePropagation === 'auto';
  const tShell = useCallback((key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_SHELL_FALLBACK_LABELS[key] ?? key
  ), [culture?.ready, culture?.t]);

  useEffect(() => {
    const width = overlayNav
      ? '0px'
      : dockedCollapsed && sidebarCollapsePolicy === 'hidden'
        ? '0px'
        : dockedCollapsed
          ? formatAdminShellSidebarWidthCss(ADMIN_SHELL_SIDEBAR_WIDTH_COLLAPSED_PX)
          : formatAdminShellSidebarWidthCss(sidebarExpandedWidthPx);
    document.documentElement.style.setProperty('--admin-shell-sidebar-active-width', width);
    return () => {
      document.documentElement.style.removeProperty('--admin-shell-sidebar-active-width');
    };
  }, [dockedCollapsed, overlayNav, sidebarCollapsePolicy, sidebarExpandedWidthPx]);

  const handleSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, [setSidebarCollapsed]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleMobileMenuOpenChange = useCallback((open: boolean) => {
    if (sidebarCollapsePolicy === 'hidden' && dockedCollapsed && !overlayNav && open) {
      setSidebarCollapsed(false);
      return;
    }
    setIsMobileMenuOpen(open);
    if (open) {
      setIsAiPanelOpen(false);
    }
  }, [dockedCollapsed, overlayNav, setIsAiPanelOpen, setSidebarCollapsed, sidebarCollapsePolicy]);

  useMobileShellDrawer(isMobileMenuOpen, closeMobileMenu);

  useEffect(() => {
    if (!overlayNav) {
      setIsMobileMenuOpen(false);
    }
  }, [overlayNav]);

  useEffect(() => {
    if (isAiPanelOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isAiPanelOpen]);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen request failed: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleShellNavigate = useCallback((path: string) => {
    navigateShell(path, () => {
      setIsMobileMenuOpen(false);
    });
  }, [navigateShell]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const { treeGroups: visibleNavGroups, quickNavItems, headerItems } = useMemo(
    () => composeStudioSidebarNav(navGroups),
    [navGroups],
  );

  const headerContext = useMemo(
    () => resolveAdminShellHeaderContext({
      groups: navGroups,
      pathname: location.pathname,
      config,
      mountId,
      t: tShell,
      fallbackLabel: tShell('shell.portalDashboard'),
      fallbackDescription: tShell('shell.welcome'),
    }),
    [config, location.pathname, mountId, navGroups, tShell],
  );
  const headerOverride = useShellHeaderOverrideState();
  const headerModule = useMemo(
    () => mergeShellHeaderModule(headerContext, headerOverride),
    [headerContext, headerOverride],
  );

  const shellFallbackLabel = tShell('shell.portalDashboard');
  useAdminShellDocumentTitle({
    module: headerModule,
    fallbackLabel: shellFallbackLabel,
    portalWindowTitle: brand.windowTitle,
    pageTitleReady: isAdminShellPageTitleReady(
      headerModule,
      shellFallbackLabel,
      headerContext.item.pageKey,
    ),
  });

  const chromeStripped = isDashboardChromeStrippedView(location.pathname, location.search);
  const studioPageKey = headerContext.item.pageKey ?? null;
  const studioPageTitle = headerModule.label ?? shellFallbackLabel;

  const studioToolsHost = (content: React.ReactNode) => (
    <StudioToolsHostProviders pageKey={studioPageKey} pageTitle={studioPageTitle}>
      <FeedbackWindowChromeHostProviders>
        {content}
      </FeedbackWindowChromeHostProviders>
    </StudioToolsHostProviders>
  );

  if (chromeStripped) {
    return studioToolsHost(
      <div
        className="flex h-screen w-full flex-col overflow-hidden bg-white"
        data-testid="dashboard-embed-shell"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <ErrorBoundary
          context="AdminOutlet"
          title={tShell('shell.pageLoadFailed')}
          fallbackClassName="flex min-h-[240px] w-full flex-1 items-center justify-center p-6"
        >
          <Suspense fallback={<AppRouteLoading variant="embedded" logoSrc={brand.logoUrl} logoAlt={brand.title} />}>
            <ShellRouteEnter>
              <Outlet />
            </ShellRouteEnter>
          </Suspense>
        </ErrorBoundary>
      </div>,
    );
  }

  return studioToolsHost(
    <AdminChromeLayoutWidthHost portal={application}>
    {studioToolsGate ? <PageLoadProfileTracker /> : null}
    <div
      className={`${ADMIN_SHELL_ROOT_CLASS} ${APPENDOO_DOCK_LAYOUT_PADDING_CLASS}`}
      data-admin-shell-root
      data-sidebar-collapsed={!overlayNav && dockedCollapsed ? 'true' : undefined}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        ['--admin-shell-sidebar-active-width' as string]: overlayNav
          ? '0px'
          : dockedCollapsed && sidebarCollapsePolicy === 'hidden'
            ? '0px'
            : dockedCollapsed
              ? formatAdminShellSidebarWidthCss(ADMIN_SHELL_SIDEBAR_WIDTH_COLLAPSED_PX)
              : formatAdminShellSidebarWidthCss(sidebarExpandedWidthPx),
      }}
    >
      <PackageSlotRegistryHost />
      <ShellChromeEnter className="h-full w-full overflow-hidden">
        <AtmosphereBackdrop className="admin-shell-atmosphere-main" />
        <ShellOverlayPortal active={overlayNav}>
          {overlayNav ? (
            <div
              {...overlayMotionBackdropProps({
                open: isMobileMenuOpen,
                className: ADMIN_SHELL_MOBILE_BACKDROP_CLASS,
              })}
              onClick={closeMobileMenu}
              aria-hidden
            />
          ) : null}
          <AdminShellSidebar
            isMobileMenuOpen={isMobileMenuOpen}
            isSidebarCollapsed={dockedCollapsed}
            sidebarCollapsePolicy={sidebarCollapsePolicy}
            onSidebarCollapsedChange={handleSidebarCollapsedChange}
            isRtl={isRtl}
            visibleNavGroups={visibleNavGroups}
            pathname={location.pathname}
            expandedGroups={expandedGroups}
            onExpandedGroupsChange={setExpandedGroups}
            isExperienceMount={isExperienceMount}
            NavRenderer={NavRenderer}
            onNavigate={handleShellNavigate}
            onLogoClick={() => setIsAboutModalOpen(true)}
            quickNav={(
              <ShellChromeUtilityNav
                items={quickNavItems}
                navGroups={navGroups}
                pathname={location.pathname}
                onNavigate={handleShellNavigate}
                placement="sidebar-top"
                isSidebarCollapsed={dockedCollapsed && !overlayNav}
                isRtl={isRtl}
              />
            )}
          />
        </ShellOverlayPortal>

        <main className={ADMIN_SHELL_MAIN_CLASS}>
          <header className={ADMIN_SHELL_HEADER_CLASS} data-admin-shell-header="true">
            <AtmosphereBackdrop focus="header" />
            <ShellChromeFinish surface="header" />
            <div className={ADMIN_SHELL_HEADER_INNER_CLASS}>
              <AdminShellHeader
                isMobileMenuOpen={isMobileMenuOpen}
                onMobileMenuOpenChange={handleMobileMenuOpenChange}
                desktopNavigationMenu={desktopNavigationMenu}
                currentModule={headerModule}
                onProfileOpen={() => setIsProfileOpen(true)}
                onLogoClick={() => setIsAboutModalOpen(true)}
                displayName={displayName}
                avatarXs={avatarXs}
                avatarInitial={avatarInitial}
                primaryRole={primaryRole}
                tShell={tShell}
                pageKey={headerContext.item.pageKey}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                utilityNav={headerItems.length > 0 ? (
                  <ShellChromeUtilityNav
                    items={headerItems}
                    navGroups={navGroups}
                    pathname={location.pathname}
                    onNavigate={handleShellNavigate}
                    placement="header"
                  />
                ) : undefined}
              />
            </div>
          </header>

          <div className={ADMIN_SHELL_CONTENT_WRAPPER_CLASS}>
            <div className={ADMIN_SHELL_CONTENT_HOST_CLASS} data-shell-content-root data-admin-shell-content-host="true">
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <ErrorBoundary
                  context="AdminOutlet"
                  title={tShell('shell.pageLoadFailed')}
                  fallbackClassName="flex min-h-[240px] w-full flex-1 items-center justify-center p-6"
                >
                  <Suspense fallback={<AppRouteLoading variant="embedded" logoSrc={brand.logoUrl} logoAlt={brand.title} />}>
                    <ShellRouteEnter>
                      <Outlet />
                    </ShellRouteEnter>
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </main>

        {isProfileOpen ? (
          <Suspense fallback={null}>
            <ProfileDrawer
              isOpen
              onClose={() => setIsProfileOpen(false)}
              onLogout={handleLogout}
            />
          </Suspense>
        ) : null}
        <AboutAppModal open={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} brand={brand} />
        <FeedbackShellFab pageKey={headerContext.item.pageKey} />
      </ShellChromeEnter>
    </div>
    </AdminChromeLayoutWidthHost>,
  );
};

const AdminLayoutExperienceHost = () => {
  const mountId = useOptionalPlatformMount()?.id ?? STUDIO_MOUNT_ID;
  return (
    <ShellExperienceProvider mountId={mountId}>
      <UserShellExperienceBridge />
      <AdminLayoutFrame />
    </ShellExperienceProvider>
  );
};

export const AdminLayout = () => (
  <ShellHeaderOverrideProvider>
    <EnsurePlatformMount>
      <AdminLayoutExperienceHost />
    </EnsurePlatformMount>
  </ShellHeaderOverrideProvider>
);
