import { z } from 'zod';

const homeWidgetToneSchema = z.enum(['slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose']);

export const homeWidgetCatalogMetaSchema = z.object({
  labelKey: z.string().min(1),
  descriptionKey: z.string().min(1),
  icon: z.string().min(1),
  tone: homeWidgetToneSchema,
});

export const homeWidgetDeepLinkSchema = z.object({
  pageKey: z.string().min(1),
  query: z.record(z.string()).optional(),
  hash: z.string().optional(),
});

export const homeWidgetDefinitionSchema = z.object({
  id: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  componentRef: z.string().min(1),
  span: z.enum(['full', 'wide', 'half', 'narrow', 'compact']).optional(),
  defaultVisible: z.boolean().optional(),
  catalog: homeWidgetCatalogMetaSchema,
  requiredRoles: z.array(z.string().min(1)).optional(),
  deepLink: homeWidgetDeepLinkSchema,
});

export const homeWidgetsSchema = z.array(homeWidgetDefinitionSchema).optional();
