import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Pin } from 'lucide-react';
import { useOptionalCultureT } from '../../../core/culture/CultureContext';
import {
  addDashboardHomeShortcut,
  isDashboardHomePageKey,
  writeNavHomeShortcutDrag,
} from '../../../shared/lib/dashboardHomeShortcuts';
import { useDashboardDesignMode } from '../../../shared/lib/useDashboardDesignMode';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { isOverlayNavTier } from '../../../shared/lib/viewportTokens';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import {
  resolveNavGroupCollapsedFullLabel,
  resolveNavGroupCollapsedLabel,
  resolveNavGroupDisplayLabel,
  resolveNavGroupIcon,
  resolveCollapsedNavRailLabel,
} from '../navGroupIcons';
import type { AdminShellNavGroup, AdminShellNavItem } from '../types';
import { NavItemLink } from './NavItemLink';
import { NavItemSeparator } from './NavItemSeparator';
import type { NavRendererProps } from './navRendererTypes';
import { pageGuideNavGroupProps, pageGuideNavItemProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { PAGE_GUIDE_GROUP_ATTR } from '../../../shared/ui/shell/pageGuide/pageGuide.attrs';
import { overlayMotionPanelProps } from '../../../shared/ui/overlay-motion/overlayMotion';
import { buildSideHintContent, SideHintTooltip } from '../../../shared/ui/SideHintTooltip';
import { SidebarMenuSearch } from '../../../shared/ui/SidebarMenuSearch';
import { SidebarMenuScrollArea } from '../../../shared/ui/SidebarMenuScrollArea';
import {
  filterAdminShellNavByQuery,
  splitNavGroupsAtSearchSlot,
} from '../../../shared/lib/filterAdminShellNavByQuery';

const FLYOUT_CLOSE_DELAY_MS = 250;
const ADMIN_SHELL_SIDEBAR_SELECTOR = '#admin-shell-sidebar, .designer-shell-sidebar.admin-shell-chrome';
const FALLBACK_FLYOUT_BACKDROP_INSET_PX = 81;

function measureFlyoutBackdropInset(isRtl: boolean): number {
  if (typeof document === 'undefined') {
    return FALLBACK_FLYOUT_BACKDROP_INSET_PX;
  }

  const sidebar = document.querySelector<HTMLElement>(ADMIN_SHELL_SIDEBAR_SELECTOR);
  if (!sidebar) {
    return FALLBACK_FLYOUT_BACKDROP_INSET_PX;
  }

  const rect = sidebar.getBoundingClientRect();
  if (isRtl) {
    return Math.max(0, Math.round(window.innerWidth - rect.left));
  }

  return Math.max(0, Math.round(rect.right));
}
/** Extra space below leading ungrouped items before the first headed group. */
const UNGROUPED_START_EXTRA_GAP_PX = 6;
/** Bottom margin applied below every navigation group. */
const GROUP_BOTTOM_MARGIN_PX = 0;
/** Top margin between consecutive headed groups (after leading ungrouped blocks). */
const GROUP_SECTION_TOP_MARGIN_PX = 2;
/** Vertical padding inside the group header box so title and icon sit centered. */
const GROUP_HEADER_PADDING_Y_PX = 9;
/** Top padding inside each group's item list so items do not sit flush under the heading. */
const GROUP_ITEMS_TOP_PADDING_PX = 6;
/** Vertical gap between items inside a group (and nested children). */
const NAV_ITEM_STACK_CLASS = 'space-y-0';
/** Collapsed-rail item is 14px narrower so the active box clears the left/right edges. */
const COLLAPSED_NAV_ITEM_CLASS = 'admin-nav-item-collapsed';

const getNavigableGroupItems = (group: AdminShellNavGroup): AdminShellNavItem[] =>
  group.items.filter((item) => item.type !== 'separator' && Boolean(item.path));

/** Ungrouped single links (e.g. Dashboard) navigate directly — no hover submenu. */
const isDirectCollapsedNavGroup = (group: AdminShellNavGroup): boolean => {
  if (group.heading) {
    return false;
  }

  const navigableItems = getNavigableGroupItems(group);
  if (navigableItems.length !== 1) {
    return false;
  }

  const [item] = navigableItems;
  return !item.children?.length;
};

const groupContainsActiveItem = (
  items: AdminShellNavItem[],
  pathname: string,
  navGroups: AdminShellNavGroup[],
): boolean => items.some((item) => isAdminShellNavItemActive(navGroups, item, pathname));

type NavTreeItemLinkProps = {
  item: AdminShellNavItem;
  groups: AdminShellNavGroup[];
  pathname: string;
  isSidebarCollapsed: boolean;
  isRtl: boolean;
  onNavigate: (path: string) => void;
  nested?: boolean;
  /** Link lives under a headed nav group (section sub-items). */
  inGroup?: boolean;
};

const resolveNavItemSideHint = (
  item: AdminShellNavItem,
  isSidebarCollapsed: boolean,
): React.ReactNode => {
  const label = String(item.label ?? '').trim() || 'Page';
  const description = String(item.description ?? '').trim();
  const tone = item.iconColor || item.labelColor;
  if (isSidebarCollapsed) {
    return buildSideHintContent(label, description || undefined, tone);
  }
  if (!description || description === label) {
    return null;
  }
  return buildSideHintContent(label, description, tone);
};

const NavTreeItemLink = memo(function NavTreeItemLink({
  item,
  groups,
  pathname,
  isSidebarCollapsed,
  isRtl,
  onNavigate,
  nested = false,
  inGroup = false,
}: NavTreeItemLinkProps) {
  const t = useOptionalCultureT();
  const isDesigning = useDashboardDesignMode();
  if (item.type === 'separator' || !item.path) {
    return null;
  }

  const isActive = isAdminShellNavItemActive(groups, item, pathname);
  const sideHint = resolveNavItemSideHint(item, isSidebarCollapsed);
  const canPinToHome = Boolean(item.path) && !isDashboardHomePageKey(item.pageKey);
  const canDragToHome = canPinToHome && isDesigning;
  const pinToHome = () => {
    if (!item.path) {
      return;
    }
    const added = addDashboardHomeShortcut({
      kind: 'nav',
      pageKey: item.pageKey,
      path: item.path,
      label: item.label?.trim() || 'Page',
      icon: item.icon,
    });
    showAppFeedbackToast(
      added ? t('dashboard.myShortcuts.pinned') : t('dashboard.myShortcuts.alreadyPinned'),
      { type: added ? 'success' : 'info' },
    );
  };

  const link = (
    <NavItemLink
      path={item.path}
      onNavigate={onNavigate}
      draggable={canDragToHome}
      onDragStart={(event) => {
        if (!canDragToHome || !item.path) {
          event.preventDefault();
          return;
        }
        const wrote = writeNavHomeShortcutDrag(event.dataTransfer, {
          pageKey: item.pageKey,
          path: item.path,
          label: item.label,
          icon: item.icon,
        });
        if (!wrote) {
          event.preventDefault();
        }
      }}
      {...pageGuideNavItemProps(item.label ?? 'Page', item.description, 86, item.pageKey)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'admin-nav-item flex items-center rounded-lg group relative',
        canDragToHome && 'admin-nav-item-drag',
        isSidebarCollapsed
          ? cn(COLLAPSED_NAV_ITEM_CLASS, 'flex-col justify-center px-1 gap-0 py-2')
          : cn('min-w-0 max-w-full ps-3', canPinToHome ? 'pe-[6px]' : 'pe-3'),
        !isSidebarCollapsed && 'admin-nav-item-expanded',
        inGroup && !isSidebarCollapsed && 'admin-nav-item-in-group',
        nested && 'admin-nav-item-nested',
        isActive
          ? 'admin-nav-item-active'
          : 'text-text-ink',
      )}
    >
      {item.icon ? (
        <NavigationIcon
          iconRef={item.icon}
          className={cn(
            isSidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4',
            'transition-colors shrink-0',
            !isSidebarCollapsed && 'me-[10px]',
            isActive
              ? cn(item.iconColor || 'text-primary-700', 'opacity-100')
              : cn(
                  item.iconColor || 'text-text-nav-icon',
                  'opacity-100',
                ),
          )}
        />
      ) : null}
      {isSidebarCollapsed ? (
        <span
          dir="auto"
          className={cn(
            'w-full min-w-0 overflow-hidden text-[11px] font-mono text-center whitespace-nowrap leading-tight',
            isActive && 'font-bold',
            !isActive && item.labelColor,
          )}
        >
          {resolveCollapsedNavRailLabel(item.label ?? '', item.collapsedLabel)}
        </span>
      ) : (
        <>
          <span
            className={cn(
              'admin-nav-item-label text-xs min-w-0 flex-1',
              'whitespace-nowrap text-start',
              !isActive && item.labelColor,
            )}
          >
            <span className="admin-nav-item-label-sizer" aria-hidden="true">
              {item.label}
            </span>
            <span className="admin-nav-item-label-text">{item.label}</span>
          </span>
          <span className="admin-nav-item-trailing inline-flex shrink-0 items-center">
            <ChevronRight
              aria-hidden
              className="admin-nav-item-chevron w-3 h-3 rtl:rotate-180"
            />
            {canPinToHome ? (
              <NativeButton
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-text-nav-icon opacity-0 hover:bg-slate-200/70 hover:text-primary-700 group-hover/navpin:opacity-100"
                aria-label={t('nav.pinToHome')}
                title={t('nav.pinToHome')}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  pinToHome();
                }}
              >
                <Pin className="h-3 w-3" />
              </NativeButton>
            ) : null}
          </span>
        </>
      )}
    </NavItemLink>
  );

  return (
    <SideHintTooltip content={sideHint} isRtl={isRtl} className="group/navpin relative block w-full min-w-0">
      {link}
    </SideHintTooltip>
  );
});

type NavGroupItemsProps = {
  group: AdminShellNavGroup;
  groupIdx: number;
  groups: AdminShellNavGroup[];
  pathname: string;
  isSidebarCollapsed: boolean;
  isRtl: boolean;
  onNavigate: (path: string) => void;
  nestedContainerClassName?: string;
};

const NavGroupItems = memo(function NavGroupItems({
  group,
  groupIdx,
  groups,
  pathname,
  isSidebarCollapsed,
  isRtl,
  onNavigate,
  nestedContainerClassName,
}: NavGroupItemsProps) {
  const inGroup = Boolean(group.heading?.trim());

  return (
    <>
      {group.items.map((item, idx) => {
        if (item.type === 'separator') {
          return (
            <NavItemSeparator
              key={`group-${groupIdx}-separator-${idx}`}
              collapsed={isSidebarCollapsed}
              options={item.separatorOptions}
            />
          );
        }

        const itemChildren = item.children || [];
        const hasChildren = itemChildren.length > 0;

        return (
          <div key={`${item.label}-${idx}`} className={cn(NAV_ITEM_STACK_CLASS, 'w-full min-w-0')}>
            <NavTreeItemLink
              item={item}
              groups={groups}
              pathname={pathname}
              isSidebarCollapsed={isSidebarCollapsed}
              isRtl={isRtl}
              onNavigate={onNavigate}
              inGroup={inGroup}
            />

            {hasChildren && (
              <div className={cn(NAV_ITEM_STACK_CLASS, nestedContainerClassName)}>
                {itemChildren.map((child, childIdx) => {
                  if (child.type === 'separator') {
                    return (
                      <NavItemSeparator
                        key={`${item.label}-separator-${childIdx}`}
                        options={child.separatorOptions}
                      />
                    );
                  }

                  return (
                    <NavTreeItemLink
                      key={`${item.label}-${child.label}-${childIdx}`}
                      item={child}
                      groups={groups}
                      pathname={pathname}
                      isSidebarCollapsed={isSidebarCollapsed}
                      isRtl={isRtl}
                      onNavigate={onNavigate}
                      inGroup={inGroup}
                      nested
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

type CollapsedNavGroupFlyoutProps = {
  group: AdminShellNavGroup;
  groupIdx: number;
  groups: AdminShellNavGroup[];
  pathname: string;
  isRtl: boolean;
  isActive: boolean;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onScheduleClose: () => void;
  onClose: () => void;
};

const CollapsedNavGroupFlyout = memo(function CollapsedNavGroupFlyout({
  group,
  groupIdx,
  groups,
  pathname,
  isRtl,
  isActive,
  onNavigate,
  isOpen,
  onOpen,
  onScheduleClose,
  onClose,
}: CollapsedNavGroupFlyoutProps) {
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, right: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const groupIcon = resolveNavGroupIcon(group);
  const collapsedFullLabel = resolveNavGroupCollapsedFullLabel(group);
  const collapsedLabel = resolveNavGroupCollapsedLabel(group);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPanelPosition({
        top: rect.top,
        left: rect.right + 8,
        right: window.innerWidth - rect.left + 8,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const handleNavigate = useCallback((path: string) => {
    onClose();
    onNavigate(path);
  }, [onClose, onNavigate]);

  return (
    <>
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={onOpen}
        onMouseLeave={onScheduleClose}
        onFocus={onOpen}
        onBlur={onScheduleClose}
      >
        <button
          type="button"
          aria-label={collapsedFullLabel}
          aria-haspopup="true"
          aria-expanded={isOpen}
          className={cn(
            'admin-nav-item flex flex-col items-center justify-center gap-0 rounded-lg px-1 py-1.5 transition-all duration-200',
            COLLAPSED_NAV_ITEM_CLASS,
            isActive
              ? 'admin-nav-item-active'
              : 'text-text-ink hover:text-primary-700 hover:bg-nav-hover',
          )}
        >
          <NavigationIcon
            iconRef={groupIcon}
            className={cn(
              'w-[28px] h-[28px] shrink-0 transition-colors',
              isActive
                ? 'text-primary-700 opacity-100'
                : 'text-text-nav-icon opacity-80 hover:opacity-100',
            )}
          />
          <span
            dir="auto"
            className="w-full min-w-0 overflow-hidden whitespace-nowrap text-center text-[11px] font-mono leading-tight"
          >
            {collapsedLabel}
          </span>
        </button>
      </div>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              {...overlayMotionPanelProps({
                kind: 'flyout',
                origin: 'start',
                dir: isRtl ? 'rtl' : 'ltr',
                className: 'admin-nav-flyout-panel',
              })}
              style={{
                top: panelPosition.top,
                ...(isRtl
                  ? { right: panelPosition.right, left: 'auto' }
                  : { left: panelPosition.left, right: 'auto' }),
              }}
              onMouseEnter={onOpen}
              onMouseLeave={onScheduleClose}
            >
                {group.heading ? (
                  <div
                    className="admin-nav-group-header mb-0.5 flex items-center gap-2 px-2 font-bold uppercase tracking-wider"
                    style={{
                      paddingTop: GROUP_HEADER_PADDING_Y_PX,
                      paddingBottom: GROUP_HEADER_PADDING_Y_PX,
                    }}
                    data-sidebar-menu-group-header
                    data-expanded="true"
                    data-active={isActive ? 'true' : undefined}
                  >
                    <NavigationIcon iconRef={groupIcon} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{resolveNavGroupDisplayLabel(group.heading)}</span>
                  </div>
                ) : null}
                <div
                  className={NAV_ITEM_STACK_CLASS}
                  style={{ paddingTop: GROUP_ITEMS_TOP_PADDING_PX }}
                  data-sidebar-menu-items
                >
                  <NavGroupItems
                    group={group}
                    groupIdx={groupIdx}
                    groups={groups}
                    pathname={pathname}
                    isSidebarCollapsed={false}
                    isRtl={isRtl}
                    onNavigate={handleNavigate}
                  />
                </div>
              </div>,
            document.body,
          )
        : null}
    </>
  );
});

export const TreeNavTwoLevel: React.FC<NavRendererProps> = ({
  groups,
  pathname,
  isSidebarCollapsed,
  isRtl,
  expandedGroups,
  onExpandedGroupsChange,
  onNavigate,
  isExperienceMount = false,
  accordion = false,
  lockActiveGroup = true,
  fillHeight = false,
  groupGapPx = 0,
  requireOpenGroup = false,
}) => {
  const t = useOptionalCultureT();
  const viewportTier = useViewportTier();
  const resolvedGroupGapPx = Math.max(0, Math.min(30, Math.round(groupGapPx)));
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlayNavTier(viewportTier);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const isSearching = !isCollapsedDesktop && menuSearchQuery.trim().length > 0;
  const searchableGroups = React.useMemo(
    () => (isCollapsedDesktop ? groups : filterAdminShellNavByQuery(groups, menuSearchQuery)),
    [groups, isCollapsedDesktop, menuSearchQuery],
  );
  const visibleNavGroups = React.useMemo(
    () => searchableGroups.filter((group) =>
      group.items.some((item) => item.type !== 'separator' && Boolean(item.path)),
    ),
    [searchableGroups],
  );
  const { beforeSearch, afterSearch } = React.useMemo(
    () => splitNavGroupsAtSearchSlot(visibleNavGroups),
    [visibleNavGroups],
  );

  const [suppressedActiveGroups, setSuppressedActiveGroups] = useState<Set<string>>(() => new Set());
  const expandedGroupsRef = useRef(expandedGroups);
  expandedGroupsRef.current = expandedGroups;

  const activeGroupHeadings = React.useMemo(() => {
    const headings = new Set<string>();
    visibleNavGroups.forEach((group) => {
      if (group.heading && groupContainsActiveItem(group.items, pathname, groups)) {
        headings.add(group.heading);
      }
    });
    return headings;
  }, [groups, pathname, visibleNavGroups]);

  const headedVisibleGroups = React.useMemo(
    () => visibleNavGroups.filter((group) => Boolean(group.heading?.trim())),
    [visibleNavGroups],
  );

  const pickExclusiveAccordionHeading = useCallback((): string | null => {
    if (expandedGroups.size === 0) {
      return null;
    }

    const inNavOrder = headedVisibleGroups
      .map((group) => group.heading!.trim())
      .filter((heading) => expandedGroups.has(heading));
    const activeInSet = inNavOrder.find((heading) => activeGroupHeadings.has(heading));
    return activeInSet ?? inNavOrder[0] ?? null;
  }, [activeGroupHeadings, expandedGroups, headedVisibleGroups]);

  useEffect(() => {
    setSuppressedActiveGroups(new Set());
    if (!accordion) {
      return;
    }

    const activeHeading = visibleNavGroups.find((group) =>
      Boolean(group.heading?.trim())
      && groupContainsActiveItem(group.items, pathname, groups),
    )?.heading?.trim();
    if (!activeHeading) {
      return;
    }

    const current = expandedGroupsRef.current;
    if (current.size === 1 && current.has(activeHeading)) {
      return;
    }

    onExpandedGroupsChange(new Set([activeHeading]));
    // Sync only when the route (or accordion flag) changes so opening another section is not reset.
  }, [accordion, pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- groups/onExpandedGroupsChange read from the render that committed this pathname.

  useEffect(() => {
    if (!accordion || expandedGroups.size <= 1) {
      return;
    }

    const exclusive = pickExclusiveAccordionHeading();
    if (!exclusive) {
      return;
    }

    onExpandedGroupsChange(new Set([exclusive]));
  }, [accordion, expandedGroups, onExpandedGroupsChange, pickExclusiveAccordionHeading]);

  const isGroupExpanded = useCallback(
    (heading: string) => {
      if (accordion) {
        const exclusive = pickExclusiveAccordionHeading();
        if (exclusive) {
          if (heading === exclusive) {
            return true;
          }
          if (lockActiveGroup && activeGroupHeadings.has(heading)) {
            return true;
          }
          return false;
        }

        if (!activeGroupHeadings.has(heading)) {
          return false;
        }

        if (lockActiveGroup) {
          return true;
        }

        return !suppressedActiveGroups.has(heading);
      }

      if (expandedGroups.has(heading)) {
        return true;
      }

      if (!activeGroupHeadings.has(heading)) {
        return false;
      }

      if (lockActiveGroup) {
        return true;
      }

      return !suppressedActiveGroups.has(heading);
    },
    [
      accordion,
      activeGroupHeadings,
      expandedGroups,
      lockActiveGroup,
      pickExclusiveAccordionHeading,
      suppressedActiveGroups,
    ],
  );

  const lastUngroupedStartIdx = React.useMemo(() => {
    let idx = -1;
    for (let i = 0; i < visibleNavGroups.length; i += 1) {
      if (!visibleNavGroups[i]!.heading?.trim()) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [visibleNavGroups]);

  const countExpandedHeadedGroups = useCallback(
    () => headedVisibleGroups.filter((group) => isGroupExpanded(group.heading!.trim())).length,
    [headedVisibleGroups, isGroupExpanded],
  );

  useEffect(() => {
    if (!requireOpenGroup || isCollapsedDesktop || isSearching || headedVisibleGroups.length === 0) {
      return;
    }

    if (countExpandedHeadedGroups() > 0) {
      return;
    }

    const fallbackHeading = headedVisibleGroups.find((group) =>
      activeGroupHeadings.has(group.heading!.trim()),
    )?.heading?.trim() ?? headedVisibleGroups[0]!.heading!.trim();

    onExpandedGroupsChange(accordion ? new Set([fallbackHeading]) : new Set([fallbackHeading]));
    setSuppressedActiveGroups((current) => {
      if (!current.has(fallbackHeading)) {
        return current;
      }
      const next = new Set(current);
      next.delete(fallbackHeading);
      return next;
    });
  }, [
    accordion,
    activeGroupHeadings,
    countExpandedHeadedGroups,
    headedVisibleGroups,
    isCollapsedDesktop,
    isSearching,
    onExpandedGroupsChange,
    requireOpenGroup,
  ]);

  const toggleGroupExpansion = useCallback((heading: string) => {
    if (lockActiveGroup && activeGroupHeadings.has(heading)) {
      return;
    }

    const currentlyExpanded = isGroupExpanded(heading);

    if (currentlyExpanded && requireOpenGroup && countExpandedHeadedGroups() <= 1) {
      return;
    }

    if (currentlyExpanded) {
      if (activeGroupHeadings.has(heading)) {
        setSuppressedActiveGroups((current) => {
          const next = new Set(current);
          next.add(heading);
          return next;
        });
      }

      if (accordion) {
        if (expandedGroups.size > 0) {
          onExpandedGroupsChange(new Set());
        }
      } else if (expandedGroups.has(heading)) {
        const next = new Set(expandedGroups);
        next.delete(heading);
        onExpandedGroupsChange(next);
      }
      return;
    }

    if (accordion) {
      setSuppressedActiveGroups((current) => {
        const next = new Set(current);
        for (const activeHeading of activeGroupHeadings) {
          if (activeHeading !== heading) {
            next.add(activeHeading);
          }
        }
        next.delete(heading);
        return next;
      });
      onExpandedGroupsChange(new Set([heading]));
      return;
    }

    setSuppressedActiveGroups((current) => {
      if (!current.has(heading)) {
        return current;
      }
      const next = new Set(current);
      next.delete(heading);
      return next;
    });

    const next = new Set(expandedGroups);
    next.add(heading);
    onExpandedGroupsChange(next);
  }, [
    accordion,
    activeGroupHeadings,
    countExpandedHeadedGroups,
    expandedGroups,
    isGroupExpanded,
    lockActiveGroup,
    onExpandedGroupsChange,
    requireOpenGroup,
  ]);

  const [activeFlyoutId, setActiveFlyoutId] = useState<string | null>(null);
  const [flyoutBackdropInsetPx, setFlyoutBackdropInsetPx] = useState(FALLBACK_FLYOUT_BACKDROP_INSET_PX);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openFlyout = useCallback((flyoutId: string) => {
    clearCloseTimer();
    setActiveFlyoutId(flyoutId);
  }, [clearCloseTimer]);

  const scheduleCloseFlyout = useCallback((flyoutId: string) => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setActiveFlyoutId((current) => (current === flyoutId ? null : current));
    }, FLYOUT_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const closeFlyout = useCallback(() => {
    clearCloseTimer();
    setActiveFlyoutId(null);
  }, [clearCloseTimer]);

  useEffect(() => () => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!isCollapsedDesktop) {
      closeFlyout();
    }
  }, [closeFlyout, isCollapsedDesktop]);

  useLayoutEffect(() => {
    if (!activeFlyoutId || !isCollapsedDesktop) {
      return;
    }

    const updateInset = () => {
      setFlyoutBackdropInsetPx(measureFlyoutBackdropInset(isRtl));
    };

    updateInset();
    window.addEventListener('resize', updateInset);
    window.addEventListener('scroll', updateInset, true);

    return () => {
      window.removeEventListener('resize', updateInset);
      window.removeEventListener('scroll', updateInset, true);
    };
  }, [activeFlyoutId, isCollapsedDesktop, isRtl]);

  const resolveFlyoutId = (group: AdminShellNavGroup, groupIdx: number) =>
    `${group.heading ?? 'root'}-${groupIdx}`;

  const useFillHeightLayout = fillHeight && !isCollapsedDesktop && !isSearching;
  const showMenuSearch = !isCollapsedDesktop;

  const renderNavGroup = (group: AdminShellNavGroup, groupIdx: number) => {
    const groupIcon = resolveNavGroupIcon(group);
    const isActiveGroup = groupContainsActiveItem(group.items, pathname, groups);
    const groupIsOpen = !group.heading || isSearching || isGroupExpanded(group.heading);
    const followsUngroupedStartBlock = groupIdx === lastUngroupedStartIdx + 1;
    const ungroupedStartExtraGapPx = !showMenuSearch
      && groupIdx === lastUngroupedStartIdx
      && lastUngroupedStartIdx >= 0
      && lastUngroupedStartIdx < visibleNavGroups.length - 1
      ? UNGROUPED_START_EXTRA_GAP_PX
      : 0;
    const groupStackItemStyle: React.CSSProperties = {
      marginBottom: ungroupedStartExtraGapPx + GROUP_BOTTOM_MARGIN_PX,
      ...(group.heading && groupIdx > 0 && !followsUngroupedStartBlock
        ? { marginTop: GROUP_SECTION_TOP_MARGIN_PX }
        : null),
    };

    if (isCollapsedDesktop) {
      if (isDirectCollapsedNavGroup(group)) {
        const [directItem] = getNavigableGroupItems(group);

        return (
          <div key={`${group.heading ?? 'root'}-${groupIdx}`} style={groupStackItemStyle}>
            <NavTreeItemLink
              item={directItem}
              groups={groups}
              pathname={pathname}
              isSidebarCollapsed
              isRtl={isRtl}
              onNavigate={onNavigate}
            />
          </div>
        );
      }

      return (
        <div key={`${group.heading ?? 'root'}-${groupIdx}`} style={groupStackItemStyle}>
          <CollapsedNavGroupFlyout
            group={group}
            groupIdx={groupIdx}
            groups={groups}
            pathname={pathname}
            isRtl={isRtl}
            isActive={isActiveGroup}
            onNavigate={onNavigate}
            isOpen={activeFlyoutId === resolveFlyoutId(group, groupIdx)}
            onOpen={() => openFlyout(resolveFlyoutId(group, groupIdx))}
            onScheduleClose={() => scheduleCloseFlyout(resolveFlyoutId(group, groupIdx))}
            onClose={closeFlyout}
          />
        </div>
      );
    }

    return (
      <div
        key={`${group.heading ?? 'root'}-${groupIdx}`}
        style={groupStackItemStyle}
        className={cn(
          group.heading && 'admin-nav-group',
          useFillHeightLayout && groupIsOpen && 'flex min-h-0 flex-1 flex-col',
          useFillHeightLayout && !groupIsOpen && 'shrink-0',
        )}
        {...(group.heading ? { [PAGE_GUIDE_GROUP_ATTR]: '' } : {})}
        data-expanded={group.heading && groupIsOpen ? 'true' : undefined}
      >
        {group.heading && (
          <button
            type="button"
            data-expanded={groupIsOpen ? 'true' : 'false'}
            data-active={isActiveGroup ? 'true' : undefined}
            onClick={() => {
              if (group.heading && !isSearching) {
                toggleGroupExpansion(group.heading);
              }
            }}
            className="admin-nav-group-header mb-0.5 w-full flex shrink-0 items-center justify-between gap-2 px-2 font-bold uppercase tracking-wider transition-colors"
            style={{
              paddingTop: GROUP_HEADER_PADDING_Y_PX,
              paddingBottom: GROUP_HEADER_PADDING_Y_PX,
            }}
            data-sidebar-menu-group-header
            {...pageGuideNavGroupProps(
              resolveNavGroupDisplayLabel(group.heading),
              getNavigableGroupItems(group).map((item) => item.label ?? ''),
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <NavigationIcon iconRef={groupIcon} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{resolveNavGroupDisplayLabel(group.heading)}</span>
            </span>
            <ChevronRight
              className={cn(
                'w-3 h-3 shrink-0 transition-transform rtl:rotate-180',
                groupIsOpen
                  ? 'rotate-90 rtl:rotate-[270deg] opacity-80'
                  : 'opacity-50',
              )}
            />
          </button>
        )}

        {groupIsOpen ? (
          useFillHeightLayout ? (
            <SidebarMenuScrollArea
              className="min-h-0 flex-1"
              dir={isRtl ? 'rtl' : 'ltr'}
              aria-label={group.heading
                ? `${resolveNavGroupDisplayLabel(group.heading)} pages`
                : 'Navigation'}
            >
              <div
                className={NAV_ITEM_STACK_CLASS}
                style={{ paddingTop: isSearching ? 0 : GROUP_ITEMS_TOP_PADDING_PX }}
                data-sidebar-menu-items
              >
                <NavGroupItems
                  group={group}
                  groupIdx={groupIdx}
                  groups={groups}
                  pathname={pathname}
                  isSidebarCollapsed={false}
                  isRtl={isRtl}
                  onNavigate={onNavigate}
                />
              </div>
            </SidebarMenuScrollArea>
          ) : (
            <div
              className={NAV_ITEM_STACK_CLASS}
              style={{ paddingTop: isSearching ? 0 : GROUP_ITEMS_TOP_PADDING_PX }}
              data-sidebar-menu-items
            >
              <NavGroupItems
                group={group}
                groupIdx={groupIdx}
                groups={groups}
                pathname={pathname}
                isSidebarCollapsed={false}
                isRtl={isRtl}
                onNavigate={onNavigate}
              />
            </div>
          )
        ) : null}
      </div>
    );
  };

  const menuSearchSlot = showMenuSearch ? (
    <div key="sidebar-menu-search" className="mt-1 mb-[9px] shrink-0">
      <SidebarMenuSearch
        value={menuSearchQuery}
        onChange={setMenuSearchQuery}
        placeholder={t('shell.sidebar.search.placeholder')}
        ariaLabel={t('shell.sidebar.search.ariaLabel')}
      />
    </div>
  ) : null;

  const emptyNavMessage = isSearching && visibleNavGroups.length === 0
    ? t('shell.sidebar.search.noMatches')
    : isExperienceMount && visibleNavGroups.length === 0
      ? t('shell.sidebar.search.noNavItems')
      : null;

  const groupStack = (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        (useFillHeightLayout || isSearching) && 'h-full flex-1',
      )}
      style={{ rowGap: resolvedGroupGapPx }}
      data-sidebar-menu-group-gap={resolvedGroupGapPx}
      data-sidebar-menu-fill-height={useFillHeightLayout ? 'true' : undefined}
    >
      {isCollapsedDesktop
        ? visibleNavGroups.map((group, groupIdx) => renderNavGroup(group, groupIdx))
        : (
          <>
            {isSearching ? null : beforeSearch.map((group, groupIdx) => renderNavGroup(group, groupIdx))}
            {menuSearchSlot}
            {isSearching ? (
              <SidebarMenuScrollArea
                className="min-h-0 flex-1"
                dir={isRtl ? 'rtl' : 'ltr'}
                aria-label="Search results"
              >
                <div
                  className="flex min-h-0 flex-col"
                  style={{ rowGap: resolvedGroupGapPx }}
                >
                  {visibleNavGroups.map((group, groupIdx) => (
                    renderNavGroup(group, groupIdx)
                  ))}
                  {emptyNavMessage ? (
                    <div className="px-3 py-2 text-xs text-slate-400">{emptyNavMessage}</div>
                  ) : null}
                </div>
              </SidebarMenuScrollArea>
            ) : (
              <div
                className={cn(
                  'flex min-h-0 flex-col',
                  useFillHeightLayout && 'min-h-0 flex-1',
                )}
                style={{ rowGap: resolvedGroupGapPx }}
              >
                {afterSearch.map((group, groupIdx) => (
                  renderNavGroup(group, beforeSearch.length + groupIdx)
                ))}
                {emptyNavMessage ? (
                  <div className="px-3 py-2 text-xs text-slate-400">{emptyNavMessage}</div>
                ) : null}
              </div>
            )}
          </>
        )}
      {isCollapsedDesktop && emptyNavMessage ? (
        <div className="px-3 py-2 text-xs text-slate-400">{emptyNavMessage}</div>
      ) : null}
    </div>
  );

  return (
    <>
      {isCollapsedDesktop && activeFlyoutId && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="admin-nav-flyout-backdrop"
              aria-hidden="true"
              style={{
                insetInlineStart: `${flyoutBackdropInsetPx}px`,
                insetInlineEnd: 0,
              }}
            />,
            document.body,
          )
        : null}
      {groupStack}
    </>
  );
};
