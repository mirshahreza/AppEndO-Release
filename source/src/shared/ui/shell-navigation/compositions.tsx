import * as React from 'react';
import { ChevronDown, Menu, MoreHorizontal } from 'lucide-react';
import type {
  ShellBackdropTreatment,
  ShellRegionShapeDepth,
} from '../../api/contracts/shell-designer';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../lib/navigationIcons/NavigationIcon';
import { AppSearchBox } from '../AppSearchBox';
import { NativeButton } from '../NativeButton';
import {
  ShellResponsiveDrawer,
  ShellResponsivePopover,
  shellBackdropStyle,
  shellShapeDepthClass,
} from '../shell-foundation';
import {
  ShellNavBadge,
  ShellNavDescription,
  ShellNavDivider,
  ShellNavGroup,
  ShellNavIcon,
  ShellNavItem,
  ShellNavLink,
  ShellNavList,
  ShellNavRoot,
  ShellNavTrigger,
} from './primitives';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps, pageGuideNavGroupProps, pageGuideNavItemProps } from '../shell/pageGuide/pageGuideChrome';
import { PAGE_GUIDE_GROUP_ATTR } from '../shell/pageGuide/pageGuide.attrs';
import { buildSideHintContent, SideHintTooltip } from '../SideHintTooltip';
import {
  countShellNavigationItems,
  getShellNavigationItemHref,
  isShellNavigationItemActive,
  type ShellNavigationCommonProps,
  type ShellNavigationGroup,
  type ShellNavigationItem,
} from './types';

type ResolvedCommon = Required<
  Pick<ShellNavigationCommonProps, 'currentPath' | 'getItemHref' | 'isItemActive' | 'renderIcon'>
>;

const useResolvedCommon = (props: ShellNavigationCommonProps): ResolvedCommon => ({
  currentPath: props.currentPath ?? '',
  getItemHref: props.getItemHref ?? getShellNavigationItemHref,
  isItemActive: props.isItemActive ?? isShellNavigationItemActive,
  renderIcon: props.renderIcon ?? ((icon) => (
    <NavigationIcon iconRef={icon} className="h-4 w-4" />
  )),
});

const itemKey = (item: ShellNavigationItem, index: number) =>
  `${item.pageKey ?? item.path ?? item.routePattern ?? item.label ?? 'item'}-${index}`;

type ItemLinksProps = ShellNavigationCommonProps & {
  items: readonly ShellNavigationItem[];
  depth?: number;
  compact?: boolean;
  onRouteActivation?: () => void;
};

const ShellNavigationItemLinks: React.FC<ItemLinksProps> = (props) => {
  const {
    items,
    depth = 0,
    compact = false,
    onNavigate,
    onRouteActivation,
    density = 'default',
    presentation,
  } = props;
  const resolved = useResolvedCommon(props);
  return (
    <ShellNavList className={cn(
      density === 'relaxed' ? 'space-y-1.5' : density === 'compact' ? 'space-y-0' : 'space-y-0.5',
      depth > 0 && 'ps-4',
    )}>
      {items.map((item, index) => {
        if (item.type === 'separator') return <ShellNavDivider key={`divider-${index}`} />;
        const href = resolved.getItemHref(item);
        const active = resolved.isItemActive(item, resolved.currentPath);
        const label = item.label ?? href ?? 'Navigation item';
        const showSideHint = presentation?.labelMode === 'icon-only'
          || (Boolean(compact) && Boolean(item.description?.trim()));
        const link = href ? (
              <ShellNavLink
                href={href}
                active={active}
                onNavigate={(path) => {
                  onRouteActivation?.();
                  onNavigate?.(path, item);
                }}
                {...pageGuideNavItemProps(label, item.description, 86, item.pageKey)}
                className={cn(
                  'relative flex w-full items-start gap-2 px-2 text-start text-sm',
                  density === 'compact' ? 'py-1 text-xs' : density === 'relaxed' ? 'py-2.5' : 'py-1.5',
                  active
                    ? cn(
                        'font-bold text-primary-700',
                        presentation?.activeIndicator === 'underline' && 'rounded-none border-b-2 border-primary-600 bg-transparent',
                        presentation?.activeIndicator === 'bar' && 'before:absolute before:inset-y-1 before:start-0 before:w-1 before:rounded-full before:bg-primary-600',
                        presentation?.activeIndicator === 'pill' && 'rounded-full bg-primary-subtle',
                        (!presentation?.activeIndicator || presentation.activeIndicator === 'surface') && 'bg-primary-subtle',
                      )
                    : 'font-semibold text-text-ink hover:bg-nav-hover hover:text-primary-700',
                )}
                aria-label={presentation?.labelMode === 'icon-only' ? label : undefined}
              >
                {presentation?.showIcons !== false && presentation?.labelMode !== 'label' && item.icon ? (
                  <ShellNavIcon className="mt-0.5">{resolved.renderIcon(item.icon, item)}</ShellNavIcon>
                ) : null}
                <span className={cn('min-w-0 flex-1', presentation?.labelMode === 'icon-only' && 'sr-only')}>
                  <span className={cn('block truncate', item.labelColor)}>{label}</span>
                  {!compact && item.description ? (
                    <ShellNavDescription className="line-clamp-2">{item.description}</ShellNavDescription>
                  ) : null}
                </span>
                {presentation?.showBadges !== false && item.presentation?.badge ? <ShellNavBadge>{item.presentation.badge}</ShellNavBadge> : null}
              </ShellNavLink>
            ) : (
              <span className="flex w-full items-start gap-2 px-2 py-1.5 text-sm text-text-ink">
                {presentation?.showIcons !== false && presentation?.labelMode !== 'label' && item.icon ? (
                  <ShellNavIcon className="mt-0.5">{resolved.renderIcon(item.icon, item)}</ShellNavIcon>
                ) : null}
                <span>{label}</span>
              </span>
            );

        return (
          <ShellNavItem key={itemKey(item, index)}>
            {showSideHint ? (
              <SideHintTooltip
                content={buildSideHintContent(label, item.description, item.iconColor || item.labelColor)}
                className="flex w-full min-w-0"
              >
                {link}
              </SideHintTooltip>
            ) : link}
            {item.children?.length ? (
              <ShellNavigationItemLinks {...props} items={item.children} depth={depth + 1} />
            ) : null}
          </ShellNavItem>
        );
      })}
    </ShellNavList>
  );
};

export type ShellSidebarNavigationProps = ShellNavigationCommonProps & {
  expandedGroups?: ReadonlySet<string>;
  defaultExpandedGroups?: readonly string[];
  onExpandedGroupsChange?: (groups: Set<string>) => void;
};

export const ShellSidebarNavigation: React.FC<ShellSidebarNavigationProps> = ({
  groups,
  ariaLabel = 'Sidebar navigation',
  className,
  expandedGroups,
  defaultExpandedGroups = [],
  onExpandedGroupsChange,
  ...common
}) => {
  const configuredDefaults = defaultExpandedGroups.length
    ? defaultExpandedGroups
    : common.presentation?.groupDefault === 'expanded-all'
      ? groups.map((group, index) => group.heading?.trim() || `group-${index}`)
      : common.presentation?.groupDefault === 'expanded-active'
        ? groups.flatMap((group, index) =>
            group.items.some((item) => item.active)
              ? [group.heading?.trim() || `group-${index}`]
              : [])
        : [];
  const [internalExpanded, setInternalExpanded] = React.useState(() => new Set(configuredDefaults));
  const openGroups = expandedGroups ?? internalExpanded;
  const setOpenGroups = (next: Set<string>) => {
    if (expandedGroups == null) setInternalExpanded(next);
    onExpandedGroupsChange?.(next);
  };
  const baseId = React.useId();

  return (
    <ShellNavRoot aria-label={ariaLabel} className={cn('space-y-2', className)}>
      {groups.map((group, index) => {
        const key = group.heading?.trim() || `group-${index}`;
        const panelId = `${baseId}-group-${index}`;
        const open = !group.heading || openGroups.has(key);
        return (
          <ShellNavGroup
            key={key}
            aria-labelledby={group.heading ? `${panelId}-trigger` : undefined}
            className={cn(
              common.presentation?.groupStyle === 'divided' && 'border-b border-divider pb-2',
              common.presentation?.groupStyle === 'cards' && 'rounded-lg border border-divider bg-content1 p-1.5 shadow-sm',
            )}
            {...(group.heading ? { [PAGE_GUIDE_GROUP_ATTR]: '' } : {})}
          >
            {group.heading ? (
              <ShellNavTrigger
                id={`${panelId}-trigger`}
                controls={panelId}
                expanded={open}
                onClick={() => {
                  const next = common.presentation?.groupExpansion === 'accordion'
                    ? new Set<string>()
                    : new Set(openGroups);
                  if (open) next.delete(key);
                  else next.add(key);
                  setOpenGroups(next);
                }}
                className="flex w-full items-center justify-between gap-2 px-2 py-1 text-start text-xs font-bold uppercase tracking-wider text-nav-group-header hover:bg-nav-hover"
                {...pageGuideNavGroupProps(
                  group.heading,
                  group.items.map((item) => item.label ?? ''),
                )}
              >
                <span>{group.heading}</span>
                <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
              </ShellNavTrigger>
            ) : null}
            {open ? (
              <div id={panelId}>
                <ShellNavigationItemLinks groups={groups} items={group.items} {...common} />
              </div>
            ) : null}
          </ShellNavGroup>
        );
      })}
    </ShellNavRoot>
  );
};

export type ShellSidebarRailNavigationProps = ShellNavigationCommonProps;
export const ShellSidebarRailNavigation: React.FC<ShellSidebarRailNavigationProps> = (props) => {
  const resolved = useResolvedCommon(props);
  return (
    <ShellNavRoot aria-label={props.ariaLabel ?? 'Sidebar rail navigation'} className={props.className}>
      <ShellNavList className="space-y-1">
        {props.groups.flatMap((group) => group.items).map((item, index) => {
          if (item.type === 'separator') return <ShellNavDivider key={`divider-${index}`} />;
          const href = resolved.getItemHref(item);
          if (!href) return null;
          const label = item.label ?? href;
          const active = resolved.isItemActive(item, resolved.currentPath);
          return (
            <ShellNavItem key={itemKey(item, index)}>
              <SideHintTooltip
                content={buildSideHintContent(label, item.description, item.iconColor || item.labelColor)}
                className="flex w-full min-w-0"
              >
                <ShellNavLink
                  href={href}
                  active={active}
                  aria-label={label}
                  onNavigate={(path) => props.onNavigate?.(path, item)}
                  {...pageGuideNavItemProps(label, item.description, 86, item.pageKey)}
                  className={cn(
                    'relative flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-[10px]',
                    active
                      ? 'admin-nav-item-active font-bold text-primary-700'
                      : 'font-semibold text-text-ink hover:bg-nav-hover hover:text-primary-700',
                  )}
                >
                  {item.icon ? <ShellNavIcon>{resolved.renderIcon(item.icon, item)}</ShellNavIcon> : null}
                  <span className="w-full truncate">{label}</span>
                </ShellNavLink>
              </SideHintTooltip>
            </ShellNavItem>
          );
        })}
      </ShellNavList>
    </ShellNavRoot>
  );
};

export type ShellMegaMenuGroupProps = {
  group: ShellNavigationGroup;
  common: ShellNavigationCommonProps;
  onRouteActivation?: () => void;
  className?: string;
  showIcon?: boolean;
};
export const ShellMegaMenuGroup: React.FC<ShellMegaMenuGroupProps> = ({
  group,
  common,
  onRouteActivation,
  className,
  showIcon = false,
}) => (
  <ShellNavGroup className={cn('min-w-0', className)}>
    {group.heading ? (
      <h3 className="mb-1 flex items-center gap-1 px-2 text-xs font-bold uppercase tracking-wider text-nav-group-header">
        {showIcon && group.icon ? <NavigationIcon iconRef={group.icon} className="h-3.5 w-3.5" /> : null}
        {group.heading}
      </h3>
    ) : null}
    <ShellNavigationItemLinks
      {...common}
      groups={common.groups}
      items={group.items}
      onRouteActivation={onRouteActivation}
    />
  </ShellNavGroup>
);

export type ShellMegaMenuFeaturedProps = {
  item: ShellNavigationItem;
  common: ShellNavigationCommonProps;
  onRouteActivation?: () => void;
  className?: string;
};
export const ShellMegaMenuFeatured: React.FC<ShellMegaMenuFeaturedProps> = ({
  item,
  common,
  onRouteActivation,
  className,
}) => {
  const resolved = useResolvedCommon(common);
  const href = resolved.getItemHref(item);
  if (!href) return null;
  return (
    <ShellNavLink
      href={href}
      active={resolved.isItemActive(item, resolved.currentPath)}
      onNavigate={(path) => {
        onRouteActivation?.();
        common.onNavigate?.(path, item);
      }}
      className={cn('block rounded-lg border border-primary-100 bg-primary-50/50 p-3', className)}
      {...pageGuideNavItemProps(item.label ?? 'Page', item.description, 86, item.pageKey)}
    >
      {item.presentation?.imageAssetRef ? (
        <img src={item.presentation.imageAssetRef} alt="" className="mb-2 h-20 w-full rounded-md object-cover" />
      ) : null}
      <span className="font-bold text-primary-700">{item.label}</span>
      {item.description ? <ShellNavDescription className="mt-1">{item.description}</ShellNavDescription> : null}
    </ShellNavLink>
  );
};

export type ShellMegaMenuPanelProps = ShellNavigationCommonProps & {
  id?: string;
  featuredArea?: 'none' | 'start' | 'end';
  onRouteActivation?: () => void;
  className?: string;
  columns?: 2 | 3 | 4;
  panelWidth?: 'trigger' | 'contained' | 'wide' | 'full';
  groupStyle?: 'plain' | 'sectioned' | 'cards';
  showDescriptions?: boolean;
  showGroupIcons?: boolean;
  surfaceTreatment?: ShellBackdropTreatment | { mode: 'inherit' };
  shapeDepth?: ShellRegionShapeDepth | { mode: 'inherit' };
  readability?: 'none' | 'auto-scrim' | 'solid-panel';
};
export const ShellMegaMenuPanel = React.forwardRef<HTMLDivElement, ShellMegaMenuPanelProps>(
  ({
    groups,
    featuredArea = 'none',
    onRouteActivation,
    className,
    columns = 3,
    panelWidth = 'wide',
    groupStyle = 'plain',
    showDescriptions = true,
    showGroupIcons = false,
    surfaceTreatment,
    shapeDepth,
    readability = 'none',
    ...common
  }, ref) => {
    const allItems = groups.flatMap((group) => group.items);
    const featured = allItems.find((item) => item.presentation?.featured);
    const commonProps = { groups, ...common };
    const featuredNode = featuredArea !== 'none' && featured ? (
      <ShellMegaMenuFeatured
        item={featured}
        common={commonProps}
        onRouteActivation={onRouteActivation}
        className="min-w-48"
      />
    ) : null;
    return (
      <div
        ref={ref}
        className={cn(
          'grid max-h-[min(32rem,calc(100dvh-2rem))] gap-3 overflow-auto rounded-xl border border-divider bg-content1 p-3 text-foreground shadow-large',
          columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3',
          panelWidth === 'trigger' && 'w-full min-w-56',
          panelWidth === 'contained' && 'w-[min(64rem,calc(100vw-2rem))]',
          panelWidth === 'wide' && 'w-[min(72rem,calc(100vw-2rem))]',
          panelWidth === 'full' && 'w-[calc(100vw-2rem)]',
          groupStyle === 'sectioned' && 'divide-x divide-divider',
          groupStyle === 'cards' && '[&_[data-shell-nav-group]]:rounded-lg [&_[data-shell-nav-group]]:border [&_[data-shell-nav-group]]:border-divider [&_[data-shell-nav-group]]:p-2',
          !showDescriptions && '[&_[data-shell-nav-description]]:hidden',
          shapeDepth && !('mode' in shapeDepth) && shellShapeDepthClass(shapeDepth),
          readability === 'auto-scrim' && 'bg-content1/85 backdrop-blur-sm motion-reduce:backdrop-blur-none',
          readability === 'solid-panel' && 'bg-content1',
          className,
        )}
        style={surfaceTreatment?.mode === 'inherit' ? undefined : shellBackdropStyle(surfaceTreatment)}
      >
        {featuredArea === 'start' ? featuredNode : null}
        {groups.map((group, index) => (
          <ShellMegaMenuGroup
            key={`${group.heading ?? 'group'}-${index}`}
            group={group}
            common={commonProps}
            onRouteActivation={onRouteActivation}
            showIcon={showGroupIcons}
          />
        ))}
        {featuredArea === 'end' ? featuredNode : null}
      </div>
    );
  },
);
ShellMegaMenuPanel.displayName = 'ShellMegaMenuPanel';

type MegaNavigationProps = ShellNavigationCommonProps & {
  orientation: 'sidebar' | 'top';
  featuredArea?: 'none' | 'start' | 'end';
  mega?: Omit<ShellMegaMenuPanelProps, keyof ShellNavigationCommonProps | 'id' | 'className' | 'onRouteActivation' | 'featuredArea'>;
  openBehavior?: 'click' | 'hover-and-click';
};

const ShellMegaNavigation: React.FC<MegaNavigationProps> = ({
  groups,
  orientation,
  featuredArea = 'none',
  mega,
  openBehavior = 'click',
  ariaLabel,
  className,
  ...common
}) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLElement>(null);
  const triggerRefs = React.useRef(new Map<number, HTMLButtonElement>());
  const baseId = React.useId();
  const close = React.useCallback((returnFocus = false) => {
    setOpenIndex((current) => {
      if (returnFocus && current != null) triggerRefs.current.get(current)?.focus();
      return null;
    });
  }, []);

  React.useEffect(() => close(false), [common.currentPath, close]);
  React.useEffect(() => {
    if (openIndex == null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, openIndex]);

  return (
    <ShellNavRoot
      ref={rootRef}
      aria-label={ariaLabel ?? `${orientation === 'top' ? 'Top' : 'Sidebar'} mega navigation`}
      className={cn(orientation === 'top' ? 'flex items-center gap-1' : 'space-y-1', className)}
    >
      {groups.map((group, index) => {
        const panelId = `${baseId}-mega-${index}`;
        const open = openIndex === index;
        return (
          <ShellNavGroup
            key={`${group.heading ?? 'group'}-${index}`}
            className="relative"
            onMouseEnter={() => {
              if (openBehavior === 'hover-and-click') setOpenIndex(index);
            }}
            onMouseLeave={() => {
              if (openBehavior === 'hover-and-click') setOpenIndex(null);
            }}
          >
            <ShellNavTrigger
              ref={(node) => {
                if (node) triggerRefs.current.set(index, node);
                else triggerRefs.current.delete(index);
              }}
              controls={panelId}
              expanded={open}
              onClick={() => setOpenIndex(open ? null : index)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm font-semibold text-text-nav hover:bg-nav-hover hover:text-primary-700"
            >
              <span>{group.heading ?? 'Navigation'}</span>
              <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </ShellNavTrigger>
            {open ? (
              <ShellMegaMenuPanel
                id={panelId}
                groups={[group]}
                {...common}
                featuredArea={featuredArea}
                {...mega}
                onRouteActivation={() => close(false)}
                className={cn(
                  'z-40 min-w-64',
                  orientation === 'top'
                    ? cn('absolute start-0 top-full mt-1', !mega?.panelWidth && 'w-[min(48rem,calc(100vw-2rem))]')
                    : cn('absolute start-full top-0 ms-1', !mega?.panelWidth && 'w-[min(42rem,calc(100vw-2rem))]'),
                )}
              />
            ) : null}
          </ShellNavGroup>
        );
      })}
    </ShellNavRoot>
  );
};

export type ShellSidebarMegaNavigationProps = Omit<MegaNavigationProps, 'orientation'>;
export const ShellSidebarMegaNavigation: React.FC<ShellSidebarMegaNavigationProps> = (props) => (
  <ShellMegaNavigation {...props} orientation="sidebar" />
);

export type ShellTopMegaNavigationProps = Omit<MegaNavigationProps, 'orientation'>;
export const ShellTopMegaNavigation: React.FC<ShellTopMegaNavigationProps> = (props) => (
  <ShellMegaNavigation {...props} orientation="top" />
);

export type ShellTopNavigationProps = ShellNavigationCommonProps;
export const ShellTopNavigation: React.FC<ShellTopNavigationProps> = (props) => {
  const items = props.groups.flatMap((group) => group.items).filter((item) => item.type !== 'separator');
  return (
    <ShellNavRoot
      aria-label={props.ariaLabel ?? 'Top navigation'}
      className={cn(
        'flex flex-wrap items-center gap-1 [&>ul]:flex [&>ul]:flex-wrap [&>ul]:items-center',
        props.alignment === 'center' && 'justify-center',
        props.alignment === 'end' && 'justify-end',
        props.alignment === 'space-between' && 'justify-between [&>ul]:w-full [&>ul]:justify-between',
        props.className,
      )}
    >
      <ShellNavigationItemLinks {...props} items={items} compact />
    </ShellNavRoot>
  );
};

export type ShellTopNavigationOverflowProps = ShellNavigationCommonProps & {
  itemEstimatePx?: number;
  moreLabel?: string;
};
export const ShellTopNavigationOverflow: React.FC<ShellTopNavigationOverflowProps> = ({
  itemEstimatePx = 112,
  moreLabel = 'More',
  ...props
}) => {
  const rootRef = React.useRef<HTMLElement>(null);
  const moreTriggerRef = React.useRef<HTMLButtonElement>(null);
  const [capacity, setCapacity] = React.useState(Number.POSITIVE_INFINITY);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const all = props.groups.flatMap((group) => group.items).filter((item) => item.type !== 'separator');
  const resolved = useResolvedCommon(props);
  const prioritized = [...all].sort((left, right) => {
    const leftActive = resolved.isItemActive(left, resolved.currentPath);
    const rightActive = resolved.isItemActive(right, resolved.currentPath);
    return Number(rightActive) - Number(leftActive);
  });

  React.useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const update = () => setCapacity(Math.max(1, Math.floor(node.clientWidth / itemEstimatePx) - 1));
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, [itemEstimatePx]);
  React.useEffect(() => setMoreOpen(false), [props.currentPath]);
  React.useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMoreOpen(false);
        moreTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const visible = prioritized.slice(0, capacity);
  const overflow = prioritized.slice(capacity);
  const moreId = React.useId();
  return (
    <ShellNavRoot
      ref={rootRef}
      aria-label={props.ariaLabel ?? 'Top navigation'}
      className={cn('relative flex min-w-0 items-center gap-1', props.className)}
    >
      <ShellNavigationItemLinks {...props} items={visible} compact />
      {overflow.length ? (
        <div className="relative">
          <ShellNavTrigger
            ref={moreTriggerRef}
            controls={moreId}
            expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-sm font-semibold"
          >
            <MoreHorizontal aria-hidden className="h-4 w-4" />
            {moreLabel}
          </ShellNavTrigger>
          {moreOpen ? (
            <div id={moreId} className="absolute end-0 top-full z-40 mt-1 min-w-52 rounded-lg border border-divider bg-content1 p-2 shadow-large">
              <ShellNavigationItemLinks
                {...props}
                items={overflow}
                compact
                onRouteActivation={() => setMoreOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </ShellNavRoot>
  );
};

export type ShellMobileDrawerNavigationProps = ShellNavigationCommonProps & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  side?: 'start' | 'end';
  scrollOwner?: HTMLElement | null;
  defaultExpandedGroups?: readonly string[];
};
export const ShellMobileDrawerNavigation: React.FC<ShellMobileDrawerNavigationProps> = ({
  open,
  onOpenChange,
  title = 'Navigation',
  side = 'start',
  scrollOwner,
  defaultExpandedGroups,
  ...props
}) => {
  const previousPathRef = React.useRef(props.currentPath);
  React.useEffect(() => {
    if (!open || !scrollOwner) return;
    const previous = scrollOwner.style.overflow;
    scrollOwner.style.overflow = 'hidden';
    return () => {
      scrollOwner.style.overflow = previous;
    };
  }, [open, scrollOwner]);
  React.useEffect(() => {
    if (previousPathRef.current !== props.currentPath) {
      previousPathRef.current = props.currentPath;
      if (open) onOpenChange?.(false);
    }
  }, [onOpenChange, open, props.currentPath]);

  const content = (
    <ShellSidebarNavigation
      {...props}
      defaultExpandedGroups={defaultExpandedGroups}
      className={cn('p-3', props.className)}
      onNavigate={(path, item) => {
        onOpenChange?.(false);
        props.onNavigate?.(path, item);
      }}
    />
  );
  if (open == null || !onOpenChange) {
    return <div data-shell-mobile-drawer-navigation="inline">{content}</div>;
  }
  return (
    <ShellResponsiveDrawer open={open} onOpenChange={onOpenChange} side={side} title={title}>
      {content}
    </ShellResponsiveDrawer>
  );
};

export type ShellMobilePopoverNavigationProps = ShellNavigationCommonProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactElement;
  drawerThresholdPx?: number;
  availableInlineSize?: number;
  title?: React.ReactNode;
};
export const ShellMobilePopoverNavigation: React.FC<ShellMobilePopoverNavigationProps> = ({
  open,
  onOpenChange,
  trigger = (
    <NativeButton aria-label="Open navigation" className="rounded-md p-2">
      <Menu aria-hidden className="h-5 w-5" />
    </NativeButton>
  ),
  drawerThresholdPx = 320,
  availableInlineSize,
  title,
  ...props
}) => {
  const previousPathRef = React.useRef(props.currentPath);
  React.useEffect(() => {
    if (previousPathRef.current !== props.currentPath) {
      previousPathRef.current = props.currentPath;
      if (open) onOpenChange(false);
    }
  }, [onOpenChange, open, props.currentPath]);
  const useDrawer = availableInlineSize != null && availableInlineSize < drawerThresholdPx;
  if (useDrawer) {
    return (
      <>
        {React.cloneElement(trigger, {
          'aria-expanded': open,
          onClick: () => onOpenChange(!open),
        } as never)}
        <ShellMobileDrawerNavigation
          {...props}
          open={open}
          onOpenChange={onOpenChange}
          title={title}
        />
      </>
    );
  }
  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      ariaLabel="Navigation popover"
      className="w-[min(20rem,calc(100vw-2rem))]"
    >
      <ShellSidebarNavigation
        {...props}
        onNavigate={(path, item) => {
          onOpenChange(false);
          props.onNavigate?.(path, item);
        }}
      />
    </ShellResponsivePopover>
  );
};

export type ShellFooterNavigationProps = ShellNavigationCommonProps & { stacked?: boolean };
export const ShellFooterNavigation: React.FC<ShellFooterNavigationProps> = ({
  stacked = false,
  ...props
}) => (
  <ShellNavRoot
    aria-label={props.ariaLabel ?? 'Footer navigation'}
    className={cn(
      stacked
        ? 'flex flex-col items-start'
        : 'flex flex-wrap items-center justify-center [&>ul]:flex [&>ul]:flex-wrap [&>ul]:items-center',
      props.className,
    )}
  >
    <ShellNavigationItemLinks
      {...props}
      items={props.groups.flatMap((group) => group.items).filter((item) => item.type !== 'separator')}
      compact
    />
  </ShellNavRoot>
);

export type ShellContextNavigationProps = ShellNavigationCommonProps;
export const ShellContextNavigation: React.FC<ShellContextNavigationProps> = (props) => (
  <ShellNavRoot aria-label={props.ariaLabel ?? 'Context navigation'} className={props.className}>
    <ShellNavigationItemLinks
      {...props}
      items={props.groups.flatMap((group) => group.items)}
      compact
    />
  </ShellNavRoot>
);

export type ShellNavigationSearchProps = {
  groups: readonly ShellNavigationGroup[];
  value?: string;
  onValueChange?: (value: string) => void;
  minimumItemCount?: number;
  debounceMs?: number;
  ariaLabel?: string;
  className?: string;
  onFilteredGroupsChange?: (groups: ShellNavigationGroup[]) => void;
};
export const filterShellNavigationGroups = (
  groups: readonly ShellNavigationGroup[],
  query: string,
): ShellNavigationGroup[] => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return groups.map((group) => ({ ...group, items: [...group.items] }));
  const filterItems = (items: readonly ShellNavigationItem[]): ShellNavigationItem[] =>
    items.flatMap((item) => {
      if (item.type === 'separator') return [];
      const children = filterItems(item.children ?? []);
      const matches = `${item.label ?? ''} ${item.description ?? ''}`.toLocaleLowerCase().includes(normalized);
      return matches || children.length ? [{ ...item, children: children.length ? children : item.children }] : [];
    });
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);
};

export const ShellNavigationSearch: React.FC<ShellNavigationSearchProps> = ({
  groups,
  value,
  onValueChange,
  minimumItemCount = 12,
  debounceMs = 150,
  ariaLabel = 'Search navigation',
  className,
  onFilteredGroupsChange,
}) => {
  const [internalValue, setInternalValue] = React.useState('');
  const query = value ?? internalValue;
  React.useEffect(() => {
    const timer = window.setTimeout(
      () => onFilteredGroupsChange?.(filterShellNavigationGroups(groups, query)),
      debounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [debounceMs, groups, onFilteredGroupsChange, query]);
  if (countShellNavigationItems(groups) < minimumItemCount) return null;
  return (
    <div
      className={className}
      {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'search', 30)}
    >
      <AppSearchBox
        value={query}
        onChange={(next) => {
          if (value == null) setInternalValue(next);
          onValueChange?.(next);
        }}
        ariaLabel={ariaLabel}
        placeholder="Search navigation…"
      />
    </div>
  );
};

export type ShellNavigationUtilitiesProps = React.ComponentPropsWithoutRef<'div'>;
export const ShellNavigationUtilities = React.forwardRef<HTMLDivElement, ShellNavigationUtilitiesProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex min-w-0 items-center gap-1', className)}
      data-shell-navigation-utilities=""
      {...props}
    />
  ),
);
ShellNavigationUtilities.displayName = 'ShellNavigationUtilities';
