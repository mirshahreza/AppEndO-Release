import { z } from 'zod';

export const QUERY_SURFACES_EXTENSION_KEY = 'querySurfaces';

export const queryPresetApplicationSchema = z.enum(['mandatory', 'optional', 'default-on']);

export const queryPresetVisibilitySchema = z.enum(['public', 'restricted']);

const whereConditionNodeSchema = z.object({
  kind: z.literal('condition'),
  id: z.string().min(1),
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.string(),
  valueKind: z.enum(['literal', 'context']).optional(),
  endValueKind: z.enum(['literal', 'context']).optional(),
}).strict();

const whereManualNodeSchema = z.object({
  kind: z.literal('manual'),
  id: z.string().min(1),
  expression: z.string(),
}).strict();

const whereNodeSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  whereGroupNodeSchema,
  whereConditionNodeSchema,
  whereManualNodeSchema,
]));

const whereGroupNodeSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  kind: z.literal('group'),
  id: z.string().min(1),
  op: z.enum(['and', 'or']),
  children: z.array(whereNodeSchema),
}).strict());

export const queryPresetDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9._-]+$/),
  /** Builder default / fallback when no culture entry exists for `labelKey`. */
  label: z.string().min(1),
  /** Package culture key for runtime label (e.g. `hwy.members.preset.active`). */
  labelKey: z.string().min(1).optional(),
  description: z.string().optional(),
  /** Culture key for description copy when present. */
  descriptionKey: z.string().min(1).optional(),
  where: whereGroupNodeSchema,
  application: queryPresetApplicationSchema.default('optional'),
  defaultSelected: z.boolean().optional(),
  visibility: queryPresetVisibilitySchema.default('public'),
  sortOrder: z.number().int().optional(),
  icon: z.string().optional(),
}).strict();

export type QueryPresetDefinition = z.infer<typeof queryPresetDefinitionSchema>;

export const querySurfacesDocumentSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  presets: z.array(queryPresetDefinitionSchema).default([]),
}).strict();

export type QuerySurfacesDocument = z.infer<typeof querySurfacesDocumentSchema>;

export const parseQuerySurfacesDocument = (
  extensions: Record<string, unknown> | undefined,
): QuerySurfacesDocument | null => {
  const raw = extensions?.[QUERY_SURFACES_EXTENSION_KEY];
  const parsed = querySurfacesDocumentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

export const emptyQuerySurfacesDocument = (): QuerySurfacesDocument => ({
  schemaVersion: '1.0.0',
  presets: [],
});
