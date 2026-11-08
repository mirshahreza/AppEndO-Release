import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { lazy } from 'react';
import type { HomeWidgetRegistryEntry } from '../../../shared/api/contracts/home-widgets';

export type CoreHomeWidgetProps = {
  entry: HomeWidgetRegistryEntry;
  headerIcon?: ReactNode;
};

const CORE_HOME_WIDGET_LOADERS: Record<string, () => Promise<{ default: ComponentType<CoreHomeWidgetProps> }>> = {
  'core:UsersHomeWidget': () => import('../homeWidgets/UsersHomeWidget').then((m) => ({ default: m.UsersHomeWidget })),
  'core:JobsHomeWidget': () => import('../homeWidgets/JobsHomeWidget').then((m) => ({ default: m.JobsHomeWidget })),
  'core:ScheduledTasksHomeWidget': () => import('../homeWidgets/ScheduledTasksHomeWidget').then((m) => ({ default: m.ScheduledTasksHomeWidget })),
  'core:ServerFunctionsHomeWidget': () => import('../homeWidgets/ServerFunctionsHomeWidget').then((m) => ({ default: m.ServerFunctionsHomeWidget })),
  'core:LogsHomeWidget': () => import('../homeWidgets/LogsHomeWidget').then((m) => ({ default: m.LogsHomeWidget })),
  'core:SshHubHomeWidget': () => import('../homeWidgets/RemoteHubsHomeWidgets').then((m) => ({ default: m.SshHubHomeWidget })),
  'core:FileHubHomeWidget': () => import('../homeWidgets/RemoteHubsHomeWidgets').then((m) => ({ default: m.FileHubHomeWidget })),
  'core:RdpHubHomeWidget': () => import('../homeWidgets/RemoteHubsHomeWidgets').then((m) => ({ default: m.RdpHubHomeWidget })),
  'core:CmsReviewQueueHomeWidget': () => import('../homeWidgets/CmsReviewQueueHomeWidget').then((m) => ({ default: m.CmsReviewQueueHomeWidget })),
};

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<CoreHomeWidgetProps>>>();

export function resolveCoreHomeWidgetComponent(
  componentRef: string,
): LazyExoticComponent<ComponentType<CoreHomeWidgetProps>> | null {
  const loader = CORE_HOME_WIDGET_LOADERS[componentRef];
  if (!loader) {
    return null;
  }
  let cached = lazyCache.get(componentRef);
  if (!cached) {
    cached = lazy(loader);
    lazyCache.set(componentRef, cached);
  }
  return cached;
}
