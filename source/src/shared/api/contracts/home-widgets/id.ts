import {
  DASHBOARD_LAYOUT_BLOCK_IDS,
  isDashboardLayoutBlockId,
  type DashboardLayoutBlockId,
} from '../../../lib/dashboardLayoutBlockIds';

export type DashboardWidgetId = DashboardLayoutBlockId | (string & {});

const LAYOUT_ID_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function isDynamicDashboardWidgetId(value: string): boolean {
  if (value.startsWith('module:')) {
    const rest = value.slice('module:'.length);
    if (!rest) {
      return false;
    }
    return rest.split(':').every((segment) => LAYOUT_ID_SEGMENT.test(segment));
  }
  if (value.startsWith('collection:')) {
    const id = value.slice('collection:'.length);
    return id.length > 0 && LAYOUT_ID_SEGMENT.test(id);
  }
  if (value.startsWith('package:')) {
    const rest = value.slice('package:'.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon <= 0 || lastColon >= rest.length - 1) {
      return false;
    }
    const packageId = rest.slice(0, lastColon);
    const componentKey = rest.slice(lastColon + 1);
    return packageId.length > 0 && componentKey.length > 0;
  }
  return false;
}

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string'
    && (isDashboardLayoutBlockId(value) || isDynamicDashboardWidgetId(value));
}

export function buildModuleHomeWidgetLayoutId(pageKey: string, widgetId = 'default'): string {
  if (widgetId === 'default') {
    return `module:${pageKey}`;
  }
  return `module:${pageKey}:${widgetId}`;
}

export function buildPackageHomeWidgetLayoutId(packageId: string, componentKey: string): string {
  return `package:${packageId}:${componentKey}`;
}

export function parsePackageHomeWidgetLayoutId(layoutId: string): { packageId: string; componentKey: string } | null {
  if (!layoutId.startsWith('package:')) {
    return null;
  }
  const rest = layoutId.slice('package:'.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon <= 0) {
    return null;
  }
  return {
    packageId: rest.slice(0, lastColon),
    componentKey: rest.slice(lastColon + 1),
  };
}

export const LEGACY_DASHBOARD_WIDGET_IDS: readonly DashboardLayoutBlockId[] = DASHBOARD_LAYOUT_BLOCK_IDS;
