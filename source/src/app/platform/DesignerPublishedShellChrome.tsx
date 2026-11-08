import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// Local copies of the lucide-react ChevronLeft/ChevronRight icons — this shell chrome renders
// on every authenticated page, so a static lucide-react import here forced the whole shared
// "lucide" vendor chunk eager for 2 icons.
const chevronIconBaseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
};
const ChevronLeft: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...chevronIconBaseProps} {...props}><path d="m15 18-6-6 6-6" /></svg>
);
const ChevronRight: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...chevronIconBaseProps} {...props}><path d="m9 18 6-6-6-6" /></svg>
);
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentUserDisplay } from '../../hooks/useCurrentUserDisplay';
import { PortalBrandLogo } from './PortalBrandLogo';
import { useResolvedPortalBrand } from './usePortalBrand';
import {
  resolveShellLogoHref,
  type ShellLogoConfig,
} from '../../shared/lib/shellLogoProps';
// Lazy: both are always-mounted-but-closed dialogs (gated only by an isOpen/open prop), and
// AboutAppModal/ProfileDrawer transitively import the whole shared/ui barrel (350+ re-exports).
// Since this shell chrome renders on every authenticated page, a static import here forced that
// entire barrel into the app's main entry chunk. Loaded on first open (see `everOpenedProfile`/
// `everOpenedAbout` below), not conditionally re-imported on every open/close.
const AboutAppModal = React.lazy(() => import('../../components/AboutAppModal').then((m) => ({ default: m.AboutAppModal })));
const ProfileDrawer = React.lazy(() => import('../../components/ProfileDrawer').then((m) => ({ default: m.ProfileDrawer })));
import { usePersistedAppEndooOpen } from '../../shared/ui/shell/usePersistedAppEndooOpen';
import { useAdminShellSidebarState } from '../../shared/ui/useAdminShellSidebarState';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { resolveCultureShellIsRtl } from '../../core/culture/cultureShellDirection';
import { CULTURE_SHELL_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import { cn } from '../../lib/utils';
import { useShellNavigate } from '../../shared/ui/shell/useShellNavigate';
import { AppShellHeader, type AppShellHeaderModule } from '../../layouts/appShell/AppShellHeader';
import { resolveAdminShellHeaderContext } from '../../layouts/adminShell/buildAdminShellNav';
import { mergeShellHeaderModule } from '../../layouts/adminShell/mergeShellHeaderModule';
import { isAdminShellPageTitleReady } from '../../layouts/adminShell/adminShellDocumentTitle';
import { useAdminShellDocumentTitle } from '../../layouts/adminShell/useAdminShellDocumentTitle';
import { usePlatformConfig } from './PlatformConfigProvider';
import { useOptionalPlatformMount } from './PlatformMountContext';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import { PortalMenu } from '../../layouts/adminShell/PortalMenu';
import {
  ShellHeaderOverrideProvider,
  useShellHeaderOverrideState,
} from '../../layouts/adminShell/ShellHeaderOverrideContext';
import { useAdminShellNav } from '../../layouts/adminShell/useAdminShellNav';
import { FeedbackShellFab } from '../../features/feedback/components/FeedbackShellFab';
import { StudioToolsHostProviders } from '../../features/access-assistant/components/StudioToolsHostProviders';
import { FeedbackWindowChromeHostProviders } from '../../features/feedback/components/FeedbackWindowChromeHostProviders';
import {
  ADMIN_SHELL_MOBILE_BACKDROP_CLASS,
  ADMIN_SHELL_SIDEBAR_COLLAPSE_BUTTON_CLASS,
} from '../../shared/ui/surfaceClasses';
import { ADMIN_SHELL_SIDEBAR_LOGO_EXPANDED_NUDGE_CLASS } from '../../shared/ui/adminShellSidebarMetrics';

type ShellChromeContextValue = {
  isSidebarCollapsed: boolean;
  isRtl: boolean;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isAiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  openProfile: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  tShell: (key: string) => string;
  currentModule: AppShellHeaderModule;
  displayName: string;
  avatarXs?: string | null;
  avatarInitial: string;
  primaryRole: string;
  pageKey?: string | null;
  onLogoClick: () => void;
  onNavigate: (path: string) => void;
  applicationMenuAriaLabel: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

function useShellChrome(): ShellChromeContextValue {
  const value = useContext(ShellChromeContext);
  if (!value) {
    throw new Error('Shell chrome slot rendered outside DesignerPublishedShellChromeProvider.');
  }
  return value;
}

export function useDesignerPublishedShellSidebarCollapsed(): boolean {
  return useContext(ShellChromeContext)?.isSidebarCollapsed ?? false;
}

export function useDesignerPublishedShellMobileMenuOpen(): boolean {
  return useContext(ShellChromeContext)?.isMobileMenuOpen ?? false;
}

export function useDesignerPublishedShellMobileMenuState(): readonly [
  boolean,
  (open: boolean) => void,
] {
  const context = useContext(ShellChromeContext);
  return [context?.isMobileMenuOpen ?? false, context?.setMobileMenuOpen ?? (() => undefined)] as const;
}

export function useDesignerPublishedShellDirection(): 'ltr' | 'rtl' {
  return useContext(ShellChromeContext)?.isRtl ? 'rtl' : 'ltr';
}

export type DesignerPublishedShellChromeProviderProps = {
  children: ReactNode;
  interactionMode?: 'live' | 'preview';
};

const DesignerPublishedShellChromeProviderInner: React.FC<DesignerPublishedShellChromeProviderProps> = ({
  children,
  interactionMode = 'live',
}) => {
  const { logout, currentUser } = useAuth();
  const headerOverride = useShellHeaderOverrideState();
  const { displayName, avatarXs, avatarInitial, primaryRole } = useCurrentUserDisplay();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateShell = useShellNavigate();
  const culture = useOptionalCulture();
  const { config } = usePlatformConfig();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const navGroups = useAdminShellNav(currentUser);
  const brand = useResolvedPortalBrand();

  const [isAiPanelOpen, setIsAiPanelOpen] = usePersistedAppEndooOpen();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const adminSidebar = useAdminShellSidebarState();
  const [previewSidebarCollapsed, setPreviewSidebarCollapsed] = useState(false);
  const isSidebarCollapsed = interactionMode === 'preview'
    ? previewSidebarCollapsed
    : adminSidebar.isSidebarCollapsed;
  const setSidebarCollapsed = interactionMode === 'preview'
    ? setPreviewSidebarCollapsed
    : adminSidebar.setSidebarCollapsed;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  // Once opened, keep mounting the lazy component on subsequent opens/closes so close
  // transitions keep working — only the very first open pays the chunk-load cost.
  const [everOpenedProfile, setEverOpenedProfile] = useState(false);
  const [everOpenedAbout, setEverOpenedAbout] = useState(false);

  const isRtl = resolveCultureShellIsRtl(culture);
  const tShell = useCallback((key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_SHELL_FALLBACK_LABELS[key] ?? key
  ), [culture?.ready, culture?.t]);

  const handleMobileMenuOpenChange = useCallback((open: boolean) => {
    setIsMobileMenuOpen(open);
    if (open) {
      setIsAiPanelOpen(false);
    }
  }, [setIsAiPanelOpen]);

  useEffect(() => {
    if (isAiPanelOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isAiPanelOpen]);

  useEffect(() => {
    if (isProfileOpen) setEverOpenedProfile(true);
  }, [isProfileOpen]);

  useEffect(() => {
    if (isAboutModalOpen) setEverOpenedAbout(true);
  }, [isAboutModalOpen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (interactionMode === 'preview') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen request failed: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, [interactionMode]);

  const handleShellNavigate = useCallback((path: string) => {
    if (interactionMode === 'preview') {
      setIsMobileMenuOpen(false);
      return;
    }
    navigateShell(path, () => {
      setIsMobileMenuOpen(false);
    });
  }, [interactionMode, navigateShell]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

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

  const headerModule = useMemo(
    () => mergeShellHeaderModule(headerContext, headerOverride),
    [headerContext, headerOverride],
  );

  const shellFallbackLabel = tShell('shell.portalDashboard');
  const pageTitleReady = isAdminShellPageTitleReady(
    headerModule,
    shellFallbackLabel,
    headerContext.item.pageKey,
  );
  useAdminShellDocumentTitle({
    module: headerModule,
    fallbackLabel: shellFallbackLabel,
    portalWindowTitle: brand.windowTitle,
    pageTitleReady,
    enabled: interactionMode === 'live',
  });

  const contextValue = useMemo<ShellChromeContextValue>(() => ({
    isSidebarCollapsed,
    isRtl,
    isMobileMenuOpen,
    setMobileMenuOpen: handleMobileMenuOpenChange,
    isAiPanelOpen,
    setAiPanelOpen: setIsAiPanelOpen,
    openProfile: () => {
      if (interactionMode === 'live') setIsProfileOpen(true);
    },
    isFullscreen,
    toggleFullscreen,
    tShell,
    currentModule: headerModule,
    displayName,
    avatarXs,
    avatarInitial,
    primaryRole,
    pageKey: headerContext.item.pageKey ?? null,
    onLogoClick: () => {
      if (interactionMode === 'live') setIsAboutModalOpen(true);
    },
    onNavigate: handleShellNavigate,
    applicationMenuAriaLabel: tShell('shell.switchApplication'),
    setSidebarCollapsed,
  }), [
    avatarInitial,
    avatarXs,
    headerContext.item.pageKey,
    headerModule,
    displayName,
    handleShellNavigate,
    handleMobileMenuOpenChange,
    isAiPanelOpen,
    isFullscreen,
    isMobileMenuOpen,
    isRtl,
    isSidebarCollapsed,
    primaryRole,
    setSidebarCollapsed,
    tShell,
    interactionMode,
  ]);

  return (
    <StudioToolsHostProviders
      pageKey={headerContext.item.pageKey}
      pageTitle={headerModule.label ?? shellFallbackLabel}
    >
    <FeedbackWindowChromeHostProviders>
    <ShellChromeContext.Provider value={contextValue}>
      {children}

      {isMobileMenuOpen ? (
        <div
          className={ADMIN_SHELL_MOBILE_BACKDROP_CLASS}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      {everOpenedProfile ? (
        <React.Suspense fallback={null}>
          <ProfileDrawer
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onLogout={handleLogout}
          />
        </React.Suspense>
      ) : null}
      {everOpenedAbout ? (
        <React.Suspense fallback={null}>
          <AboutAppModal open={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} brand={brand} />
        </React.Suspense>
      ) : null}
      <FeedbackShellFab pageKey={headerContext.item.pageKey} />
    </ShellChromeContext.Provider>
    </FeedbackWindowChromeHostProviders>
    </StudioToolsHostProviders>
  );
};

export const DesignerPublishedShellChromeProvider: React.FC<DesignerPublishedShellChromeProviderProps> = (props) => (
  <ShellHeaderOverrideProvider>
    <DesignerPublishedShellChromeProviderInner {...props} />
  </ShellHeaderOverrideProvider>
);

export const ShellLogoSlot: React.FC<{ config?: ShellLogoConfig | null }> = ({ config = null }) => {
  const { isSidebarCollapsed, onLogoClick } = useShellChrome();

  return (
    <span data-designer-chrome-interactive="true" className="contents">
      <PortalBrandLogo
        collapsed={isSidebarCollapsed}
        variant="sidebar"
        className={isSidebarCollapsed ? undefined : ADMIN_SHELL_SIDEBAR_LOGO_EXPANDED_NUDGE_CLASS}
        layoutLogo={config}
        onClick={resolveShellLogoHref(config) ? undefined : onLogoClick}
      />
    </span>
  );
};

export const ShellPortalMenuSlot: React.FC = () => {
  const {
    isSidebarCollapsed,
    onNavigate,
    applicationMenuAriaLabel,
    isRtl,
  } = useShellChrome();

  return (
    <PortalMenu
      isSidebarCollapsed={isSidebarCollapsed}
      onNavigate={onNavigate}
      ariaLabel={applicationMenuAriaLabel}
      isRtl={isRtl}
    />
  );
};

export const ShellSidebarToggleSlot: React.FC = () => {
  const {
    isRtl,
    isSidebarCollapsed,
    setSidebarCollapsed,
  } = useShellChrome();

  return (
    <button
      type="button"
      data-designer-chrome-interactive="true"
      onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
      className={ADMIN_SHELL_SIDEBAR_COLLAPSE_BUTTON_CLASS}
    >
      {isSidebarCollapsed ? (
        <ChevronRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
      ) : (
        <ChevronLeft className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
      )}
    </button>
  );
};

import { type ShellHeaderConfig } from '../../shared/lib/shellHeaderProps';

export const ShellHeaderChromeSlot: React.FC<{ config?: ShellHeaderConfig | null }> = ({ config = null }) => {
  const chrome = useShellChrome();

  const showLogo = config ? config.showLogo !== false : true;
  const showBreadcrumb = config ? config.showBreadcrumb !== false : true;
  const showActions = config ? config.showActions !== false : true;

  return (
    <AppShellHeader
      isMobileMenuOpen={chrome.isMobileMenuOpen}
      onMobileMenuOpenChange={chrome.setMobileMenuOpen}
      currentModule={chrome.currentModule}
      onProfileOpen={chrome.openProfile}
      onLogoClick={chrome.onLogoClick}
      displayName={chrome.displayName}
      avatarXs={chrome.avatarXs}
      avatarInitial={chrome.avatarInitial}
      primaryRole={chrome.primaryRole}
      tShell={chrome.tShell}
      pageKey={chrome.pageKey}
      showLogo={showLogo}
      showBreadcrumb={showBreadcrumb}
      showActions={showActions}
      isFullscreen={chrome.isFullscreen}
      onToggleFullscreen={chrome.toggleFullscreen}
    />
  );
};
