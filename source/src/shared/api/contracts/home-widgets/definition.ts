import type { AppSurfaceBoxTone } from '../../../ui/surfaceClasses';

export type HomeWidgetSpanPreset = 'full' | 'wide' | 'half' | 'narrow' | 'compact';

export type HomeWidgetCatalogMeta = {
  labelKey: string;
  descriptionKey: string;
  icon: string;
  tone: AppSurfaceBoxTone;
};

export type HomeWidgetDeepLink = {
  pageKey: string;
  query?: Record<string, string>;
  hash?: string;
};

export type HomeWidgetDefinition = {
  id?: string;
  enabled?: boolean;
  componentRef: string;
  span?: HomeWidgetSpanPreset;
  defaultVisible?: boolean;
  catalog: HomeWidgetCatalogMeta;
  requiredRoles?: string[];
  deepLink: HomeWidgetDeepLink;
};

export type HomeWidgetRegistryGroup = 'platform' | 'module' | 'collection' | 'package';

export type HomeWidgetRegistryEntry = HomeWidgetDefinition & {
  layoutId: string;
  group: HomeWidgetRegistryGroup;
  sourcePageKey?: string;
  sourcePackageId?: string;
  defaultSpanUnits: number;
};
