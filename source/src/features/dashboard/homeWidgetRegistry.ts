import {
  Activity,
  BarChart3,
  Bookmark,
  Inbox,
  LineChart,
  MessagesSquare,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import type { AuthUserLike } from '../../app/guards/roleAccess';
import { isAdminUser } from '../../app/guards/roleAccess';
import type { PlatformPageModule } from '../../shared/api/contracts/platform/types';
import {
  buildModuleHomeWidgetLayoutId,
  buildPackageHomeWidgetLayoutId,
  type HomeWidgetRegistryEntry,
  type HomeWidgetSpanPreset,
} from '../../shared/api/contracts/home-widgets';
import type { DashboardLayoutBlockId } from '../../shared/lib/userDashboardLayout';
import { DASHBOARD_WIDGET_CATALOG, type DashboardWidgetCatalogEntry } from './dashboardWidgetCatalog';
import { DASHBOARD_SPAN_UNITS, DASHBOARD_WIDGET_LAYOUT_SPAN } from './dashboardWidgetLayoutSpan';
import { resolvePageModuleHomeWidgetSeed } from './pageModuleHomeWidgetSeeds';

export type PackageDashboardSlotBinding = {
  packageId: string;
  componentKey: string;
  order: number;
};

const SPAN_UNITS: Record<HomeWidgetSpanPreset, number> = {
  full: DASHBOARD_SPAN_UNITS.full,
  wide: DASHBOARD_SPAN_UNITS.wide,
  half: DASHBOARD_SPAN_UNITS.half,
  narrow: DASHBOARD_SPAN_UNITS.narrow,
  compact: DASHBOARD_SPAN_UNITS.compact,
};

export function resolveHomeWidgetSpanUnits(span?: HomeWidgetSpanPreset): number {
  return SPAN_UNITS[span ?? 'half'];
}

export function buildPlatformHomeWidgetRegistryEntries(): HomeWidgetRegistryEntry[] {
  return DASHBOARD_WIDGET_CATALOG.map((entry) => platformCatalogEntryToRegistry(entry));
}

function resolvePlatformWidgetRoles(id: DashboardLayoutBlockId): string[] | undefined {
  if (id === 'kpi' || id === 'insights' || id === 'health') {
    return ['ADMIN'];
  }
  return undefined;
}

function platformCatalogEntryToRegistry(entry: DashboardWidgetCatalogEntry): HomeWidgetRegistryEntry {
  const layoutSpan = DASHBOARD_WIDGET_LAYOUT_SPAN[entry.id];
  return {
    layoutId: entry.id,
    group: 'platform',
    enabled: true,
    componentRef: `core:legacy-${entry.id}`,
    span: layoutSpan,
    defaultVisible: true,
    catalog: {
      labelKey: entry.labelKey,
      descriptionKey: entry.descriptionKey,
      icon: iconNameForPlatformBlock(entry.id),
      tone: entry.tone,
    },
    requiredRoles: resolvePlatformWidgetRoles(entry.id),
    deepLink: { pageKey: 'dashboard' },
    defaultSpanUnits: resolveHomeWidgetSpanUnits(layoutSpan),
  };
}

function iconNameForPlatformBlock(id: DashboardLayoutBlockId): string {
  const entry = DASHBOARD_WIDGET_CATALOG.find((item) => item.id === id);
  if (!entry) {
    return 'LayoutGrid';
  }
  const { icon } = entry;
  if (icon === BarChart3) return 'BarChart3';
  if (icon === LineChart) return 'LineChart';
  if (icon === Sparkles) return 'Sparkles';
  if (icon === Inbox) return 'Inbox';
  if (icon === UserRound) return 'UserRound';
  if (icon === Bookmark) return 'Bookmark';
  if (icon === MessagesSquare) return 'MessagesSquare';
  if (icon === Activity) return 'Activity';
  if (icon === Zap) return 'Zap';
  return 'LayoutGrid';
}

export function buildModuleHomeWidgetRegistryEntries(
  pageModules: PlatformPageModule[],
): HomeWidgetRegistryEntry[] {
  const entries: HomeWidgetRegistryEntry[] = [];
  for (const pageModule of pageModules) {
    if (!pageModule.enabled) {
      continue;
    }
    const widgets = pageModule.homeWidgets?.length
      ? pageModule.homeWidgets
      : resolvePageModuleHomeWidgetSeed(pageModule.pageKey);
    if (!widgets?.length) {
      continue;
    }
    for (const widget of widgets) {
      if (widget.enabled === false) {
        continue;
      }
      const widgetId = widget.id ?? 'default';
      entries.push({
        ...widget,
        layoutId: buildModuleHomeWidgetLayoutId(pageModule.pageKey, widgetId),
        group: 'module',
        sourcePageKey: pageModule.pageKey,
        defaultSpanUnits: resolveHomeWidgetSpanUnits(widget.span),
      });
    }
  }
  return entries;
}

export function buildPackageHomeWidgetRegistryEntries(
  bindings: PackageDashboardSlotBinding[],
): HomeWidgetRegistryEntry[] {
  return bindings.map((binding) => {
    const slug = binding.packageId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const componentSlug = binding.componentKey.replace(/\//g, '-');
    return {
      layoutId: buildPackageHomeWidgetLayoutId(binding.packageId, binding.componentKey),
      group: 'package',
      sourcePackageId: binding.packageId,
      enabled: true,
      componentRef: `package:${binding.packageId}/${binding.componentKey}`,
      span: 'half',
      defaultVisible: false,
      catalog: {
        labelKey: `homeWidget.package.${slug}.${componentSlug}.title`,
        descriptionKey: `homeWidget.package.${slug}.${componentSlug}.description`,
        icon: 'Puzzle',
        tone: 'indigo',
      },
      deepLink: { pageKey: 'dashboard' },
      defaultSpanUnits: resolveHomeWidgetSpanUnits('half'),
    };
  });
}

export type BuildHomeWidgetRegistryInput = {
  pageModules: PlatformPageModule[];
  packageBindings: PackageDashboardSlotBinding[];
};

export function buildHomeWidgetRegistry(input: BuildHomeWidgetRegistryInput): HomeWidgetRegistryEntry[] {
  const byId = new Map<string, HomeWidgetRegistryEntry>();
  for (const entry of buildPlatformHomeWidgetRegistryEntries()) {
    byId.set(entry.layoutId, entry);
  }
  for (const entry of buildModuleHomeWidgetRegistryEntries(input.pageModules)) {
    byId.set(entry.layoutId, entry);
  }
  for (const entry of buildPackageHomeWidgetRegistryEntries(input.packageBindings)) {
    byId.set(entry.layoutId, entry);
  }
  return [...byId.values()].sort((left, right) => left.layoutId.localeCompare(right.layoutId));
}

export function userCanAccessHomeWidgetEntry(
  entry: HomeWidgetRegistryEntry,
  user: AuthUserLike | null | undefined,
  pageModule?: PlatformPageModule,
): boolean {
  if (!user) {
    return false;
  }
  const required = entry.requiredRoles
    ?? (pageModule?.defaultRoles?.filter(Boolean) as string[] | undefined)
    ?? [];
  if (required.length === 0) {
    return true;
  }
  if (required.includes('ADMIN') && isAdminUser(user)) {
    return true;
  }
  const roles = user.roles ?? [];
  return required.some((role) => roles.includes(role));
}

export function filterHomeWidgetRegistryForUser(
  entries: HomeWidgetRegistryEntry[],
  user: AuthUserLike | null | undefined,
  pageModules: PlatformPageModule[],
): HomeWidgetRegistryEntry[] {
  const moduleByKey = new Map(pageModules.map((item) => [item.pageKey, item]));
  return entries.filter((entry) => {
    if (entry.group === 'platform') {
      return userCanAccessHomeWidgetEntry(entry, user);
    }
    if (entry.group === 'module' && entry.sourcePageKey) {
      const pageModule = moduleByKey.get(entry.sourcePageKey);
      if (!pageModule?.enabled) {
        return false;
      }
      return userCanAccessHomeWidgetEntry(entry, user, pageModule);
    }
    if (entry.group === 'package') {
      return Boolean(user);
    }
    return false;
  });
}

export function resolveHomeWidgetRegistryEntry(
  registry: HomeWidgetRegistryEntry[],
  layoutId: string,
): HomeWidgetRegistryEntry | undefined {
  return registry.find((entry) => entry.layoutId === layoutId);
}

export type DashboardWidgetCatalogGroup = 'platform' | 'modules' | 'collections' | 'package';

export type GroupedDashboardWidgetCatalogEntry = HomeWidgetRegistryEntry & {
  catalogGroup: DashboardWidgetCatalogGroup;
};

export function buildGroupedDashboardWidgetCatalog(
  registry: HomeWidgetRegistryEntry[],
): GroupedDashboardWidgetCatalogEntry[] {
  return registry.map((entry) => ({
    ...entry,
    catalogGroup: entry.group === 'module'
      ? 'modules'
      : entry.group === 'package'
        ? 'package'
        : entry.group === 'collection'
          ? 'collections'
          : 'platform',
  }));
}
