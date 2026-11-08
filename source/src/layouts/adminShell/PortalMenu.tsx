import React, { useMemo, useState } from 'react';
import { AppWindow, ChevronDown } from 'lucide-react';
import { useOptionalPortal } from '../../app/platform/PortalContext';
import { buildPortalRootPath } from '../../app/platform/platformConfigHelpers';
import { useOptionalPlatformMount } from '../../app/platform/PlatformMountContext';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessPortalAuth } from '../../app/guards/roleAccess';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { STUDIO_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';
import {
  portalUsesRedirectEntry,
  defaultHomePortal,
  defaultStudioPortal,
  isBuiltInComponentAlonePortal,
  type ExperienceManifestPortal,
} from '../../shared/api/contracts/platform/experienceManifest';
import { useExperienceManifestQuery } from '../../shared/api/queries/platform';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  useSplitButtonMenu,
} from '../../shared/ui/AppSplitButton';
import { NativeButton } from '../../shared/ui/NativeButton';
import { pageGuideChromeProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import { SideHintTooltip } from '../../shared/ui/SideHintTooltip';

export type PortalMenuProps = {
  isSidebarCollapsed: boolean;
  onNavigate: (path: string) => void;
  ariaLabel: string;
  isRtl?: boolean;
};

function resolveCurrentApplication(
  portals: ExperienceManifestPortal[],
  portalSegment: string | undefined,
): ExperienceManifestPortal | undefined {
  const segment = portalSegment?.trim() || STUDIO_PORTAL_SEGMENT;
  return portals.find((application) => application.segment === segment) ?? portals[0];
}

export const PortalMenu: React.FC<PortalMenuProps> = ({
  isSidebarCollapsed,
  onNavigate,
  ariaLabel,
  isRtl = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const application = useOptionalPortal();
  const { currentUser } = useAuth();
  const pathPrefix = useOptionalPlatformMount()?.pathPrefix ?? '';
  const manifestQuery = useExperienceManifestQuery('admin');

  const enabledApplications = useMemo(() => {
    const fromManifest = manifestQuery.data?.portals.filter((item) => item.enabled) ?? [];
    const candidates = fromManifest.length > 0
      ? fromManifest
      : [defaultHomePortal(), defaultStudioPortal()];

    return candidates.filter(
      (item) => canAccessPortalAuth(item.auth, currentUser)
        && !portalUsesRedirectEntry(item)
        && !isBuiltInComponentAlonePortal(item),
    );
  }, [currentUser, manifestQuery.data?.portals]);

  const currentApplication = resolveCurrentApplication(
    enabledApplications,
    application?.portalSegment,
  );

  const canSwitch = enabledApplications.length > 1;

  if (!canSwitch) {
    return null;
  }

  const handleSelect = (segment: string) => {
    setIsOpen(false);
    onNavigate(buildPortalRootPath(pathPrefix, segment));
  };

  if (!currentApplication) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        'relative shrink-0',
        isSidebarCollapsed ? 'px-1' : 'px-[16px]',
      )}
    >
      <SideHintTooltip
        content={isSidebarCollapsed ? currentApplication.name : null}
        isRtl={isRtl}
        className="block w-full"
      >
        <NativeButton
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'appSwitcher', 17)}
          className={cn(
            'admin-nav-item w-full flex items-center rounded-lg transition-all duration-200 group relative font-bold text-text-nav',
            isSidebarCollapsed
              ? 'flex-col justify-center px-1 gap-0.5 py-1.5'
              : 'px-2 py-1',
          )}
        >
          <AppWindow
            className={cn(
              isSidebarCollapsed ? 'w-[20px] h-[20px]' : 'w-[16px] h-[16px]',
              'shrink-0 text-primary-700',
              !isSidebarCollapsed && 'me-[10px]',
            )}
          />
          {isSidebarCollapsed ? (
            <span className="w-full min-w-0 text-[11px] font-bold font-mono text-center truncate leading-tight">
              {currentApplication.name}
            </span>
          ) : (
            <>
              <span className="text-[11px] font-bold whitespace-nowrap truncate text-start">
                {currentApplication.name}
              </span>
              <ChevronDown
                className={cn(
                  'ms-auto h-3.5 w-3.5 shrink-0 text-primary-700/70 transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </>
          )}
        </NativeButton>
      </SideHintTooltip>

      {isOpen ? (
        <div
          className={cn(
            SPLIT_BUTTON_MENU_PANEL_CLASS,
            'start-0 end-auto min-w-[10rem]',
            isSidebarCollapsed ? 'top-[calc(100%+4px)]' : 'top-[calc(100%+4px)]',
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {enabledApplications.map((item) => {
            const isActive = item.segment === currentApplication.segment;
            return (
              <NativeButton
                key={item.segment}
                type="button"
                role="option"
                aria-selected={isActive}
                className={cn(
                  SPLIT_BUTTON_MENU_ITEM_CLASS,
                  isActive && 'bg-primary-subtle/40 text-primary-700',
                )}
                onClick={() => handleSelect(item.segment)}
              >
                <AppWindow className="h-3.5 w-3.5 shrink-0 text-primary-700" />
                <span className="truncate">{item.name}</span>
              </NativeButton>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
