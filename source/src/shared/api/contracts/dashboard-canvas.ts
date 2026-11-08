import { z } from 'zod';
import { pivotSpecSchema } from './data-api/pivot';

export const DASHBOARD_CANVAS_CONFIG_PROP = 'dashboardCanvasConfig';
export const DASHBOARD_PERSONALIZABLE_PROP = 'dashboardPersonalizable';
export const DASHBOARD_WIDGET_GRID_PROP = 'dashboardGrid';

export const dashboardWidgetKindSchema = z.enum(['chart', 'kpi', 'table', 'text', 'combo']);
export type DashboardWidgetKind = z.infer<typeof dashboardWidgetKindSchema>;

export const dashboardFilterControlTypeSchema = z.enum([
  'select',
  'multiSelect',
  'dateRange',
  'text',
  'numericRange',
]);
export type DashboardFilterControlType = z.infer<typeof dashboardFilterControlTypeSchema>;

export const dashboardDomainEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  dataSourceRef: z.unknown(),
  exposedFields: z.array(z.string().min(1)).default([]),
}).strict();

export const dashboardFilterDeclarationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  domainEntryId: z.string().min(1),
  field: z.string().min(1),
  controlType: dashboardFilterControlTypeSchema,
  appliesToWidgetIds: z.array(z.string().min(1)).optional(),
  defaultValue: z.unknown().optional(),
}).strict();

export const dashboardJoinablePairSchema = z.object({
  domainEntryIdA: z.string().min(1),
  fieldA: z.string().min(1),
  domainEntryIdB: z.string().min(1),
  fieldB: z.string().min(1),
  label: z.string().optional(),
}).strict();

export const dashboardTabDeclarationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
}).strict();

export const dashboardLinkDeclarationSchema = z.object({
  label: z.string().min(1),
  target: z.union([
    z.object({ pageId: z.string().min(1) }).strict(),
    z.object({ url: z.string().min(1) }).strict(),
  ]),
  forwardFilterState: z.boolean().optional(),
}).strict();

export const dashboardCanvasPageConfigSchema = z.object({
  personalizable: z.boolean().default(false),
  domain: z.array(dashboardDomainEntrySchema).default([]),
  filters: z.array(dashboardFilterDeclarationSchema).optional(),
  joinablePairs: z.array(dashboardJoinablePairSchema).optional(),
  tabs: z.array(dashboardTabDeclarationSchema).optional(),
  dashboardLinks: z.array(dashboardLinkDeclarationSchema).optional(),
}).strict();

export type DashboardDomainEntry = z.infer<typeof dashboardDomainEntrySchema>;
export type DashboardFilterDeclaration = z.infer<typeof dashboardFilterDeclarationSchema>;
export type DashboardJoinablePair = z.infer<typeof dashboardJoinablePairSchema>;
export type DashboardCanvasPageConfig = z.infer<typeof dashboardCanvasPageConfigSchema>;

export const dashboardGridPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
}).strict();

export const dashboardComboRefSchema = z.object({
  domainEntryIdA: z.string().min(1),
  fieldA: z.string().min(1),
  domainEntryIdB: z.string().min(1),
  fieldB: z.string().min(1),
}).strict();

export const dashboardUserWidgetSchema = z.object({
  id: z.string().min(1),
  tabId: z.string().min(1).optional(),
  kind: dashboardWidgetKindSchema,
  domainEntryId: z.string().min(1).optional(),
  comboRef: dashboardComboRefSchema.optional(),
  fieldMapping: z.unknown().optional(),
  vizConfig: z.unknown().optional(),
  gridPosition: dashboardGridPositionSchema,
}).strict();

export const dashboardSavedViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  urlQueryString: z.string(),
  createdAt: z.string().min(1),
}).strict();

export const dashboardCanvasPersonalizationSchema = z.object({
  hiddenNodeIds: z.array(z.string()).default([]),
  order: z.array(z.string()).default([]),
  sizes: z.record(z.string(), z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }).strict()).default({}),
  variantSelections: z.record(z.string(), z.string()).default({}),
  userWidgets: z.array(dashboardUserWidgetSchema).default([]),
  savedViews: z.array(dashboardSavedViewSchema).default([]),
}).strict();

export type DashboardCanvasPersonalization = z.infer<typeof dashboardCanvasPersonalizationSchema>;
export type DashboardUserWidget = z.infer<typeof dashboardUserWidgetSchema>;

export const emptyDashboardCanvasPersonalization = (): DashboardCanvasPersonalization => ({
  hiddenNodeIds: [],
  order: [],
  sizes: {},
  variantSelections: {},
  userWidgets: [],
  savedViews: [],
});

export const dashboardCanvasPivotRequestSchema = z.object({
  pageId: z.string().min(1),
  domainEntryId: z.string().min(1),
  spec: pivotSpecSchema,
  widgetNodeId: z.string().min(1).optional(),
}).strict();

export const dashboardAccessPermissionSchema = z.enum(['view', 'personalize']);
export type DashboardAccessPermission = z.infer<typeof dashboardAccessPermissionSchema>;

export const parseDashboardCanvasPageConfig = (value: unknown): DashboardCanvasPageConfig => {
  if (typeof value === 'string') {
    try {
      return parseDashboardCanvasPageConfig(JSON.parse(value));
    } catch {
      return dashboardCanvasPageConfigSchema.parse({});
    }
  }
  const parsed = dashboardCanvasPageConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : dashboardCanvasPageConfigSchema.parse({});
};

export const parseDashboardCanvasPersonalization = (value: unknown): DashboardCanvasPersonalization => {
  const parsed = dashboardCanvasPersonalizationSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyDashboardCanvasPersonalization();
};

export const serializeDashboardCanvasPageConfig = (config: DashboardCanvasPageConfig): string =>
  JSON.stringify(dashboardCanvasPageConfigSchema.parse(config));
