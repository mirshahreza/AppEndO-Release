import * as React from 'react';
import { Globe } from 'lucide-react';
import { usePlatformRuntimeConfigQuery } from '../../../shared/api/queries/platform';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

export type ComponentPortalRoute = {
  mountId: string;
  mountName: string;
  routePattern: string;
  enabled: boolean;
};

/**
 * Derive which mounts/portals a component pageKey is registered to,
 * by scanning runtime config bindings.
 */
export function useComponentPortalRoutes(pageKey: string | null): {
  routes: ComponentPortalRoute[];
  isLoading: boolean;
} {
  const runtimeQuery = usePlatformRuntimeConfigQuery(Boolean(pageKey));

  const routes = React.useMemo<ComponentPortalRoute[]>(() => {
    const key = pageKey?.trim();
    if (!key || !runtimeQuery.data) return [];

    const config: PlatformRuntimeConfig = runtimeQuery.data;
    const mountById = new Map(config.mounts.map((m) => [m.id, m]));

    return config.bindings
      .filter((b) => b.pageKey === key)
      .map((b) => ({
        mountId: b.mountId,
        mountName: mountById.get(b.mountId)?.name || b.mountId,
        routePattern: b.routePattern,
        enabled: b.enabled,
      }));
  }, [pageKey, runtimeQuery.data]);

  return { routes, isLoading: runtimeQuery.isLoading };
}

export type DesignerComponentPortalRoutesProps = {
  pageKey: string | null;
  /** If true, renders as a compact inline chip list. */
  compact?: boolean;
};

/**
 * Shows all portal/mount route registrations for the active designer component.
 * Used in CD-E03 to give developers multi-portal route visibility.
 */
export const DesignerComponentPortalRoutes: React.FC<DesignerComponentPortalRoutesProps> = ({
  pageKey,
  compact = false,
}) => {
  const { routes, isLoading } = useComponentPortalRoutes(pageKey);

  if (!pageKey?.trim()) return null;
  if (isLoading) return null;
  if (routes.length === 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
        <Globe className="h-3 w-3 shrink-0" />
        <span>
          {routes.length === 1
            ? routes[0].mountName
            : `${routes.length} portals`}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500">
        <Globe className="h-3 w-3" />
        Portals
      </span>
      {routes.map((route) => (
        <span
          key={`${route.mountId}:${route.routePattern}`}
          title={`${route.mountName} — ${route.routePattern}`}
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
            route.enabled
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 line-through',
          ].join(' ')}
        >
          {route.mountName}
          <span className="font-mono text-[9px] opacity-70">{route.routePattern}</span>
        </span>
      ))}
    </div>
  );
};

/**
 * Inline warning message shown when renaming a component that has portal route
 * registrations. Used in save/rename dialogs and toolbar flows.
 */
export const DesignerRenameRoutesWarning: React.FC<{
  pageKey: string | null;
  className?: string;
}> = ({ pageKey, className }) => {
  const { routes } = useComponentPortalRoutes(pageKey);

  if (!pageKey?.trim() || routes.length === 0) return null;

  return (
    <div
      className={[
        'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span className="font-semibold">Route update notice:</span>{' '}
      Renaming this component will update its route key across{' '}
      <span className="font-semibold">{routes.length} portal registration{routes.length !== 1 ? 's' : ''}</span>.
      All portal menus linking to this page will continue to work if route propagation is set to{' '}
      <span className="font-mono font-semibold">auto</span>.
    </div>
  );
};
