import { z } from 'zod';
import { clientContextConfigSchema } from '../client-context';
import { changeReasonPolicySchema } from '../record-events';
import {
  EMPTY_FUNCTION_ACCESS_CONTROL,
  type FunctionAccessControl,
} from '../server-functions/accessControl';

const functionAccessControlSchema = z.object({
  accessMode: z.enum(['public', 'authenticated', 'specific']).optional(),
  allowRoles: z.array(z.string()),
  allowUsers: z.array(z.string()),
  denyRoles: z.array(z.string()),
  denyUsers: z.array(z.string()),
}).strict();

const serverFunctionHookConfigSchema = z.object({
  workflowName: z.string().min(1),
  fields: z.array(z.string()),
}).strict();

const serverFunctionHooksConfigSchema = z.object({
  before: serverFunctionHookConfigSchema.optional(),
  after: serverFunctionHookConfigSchema.optional(),
}).strict();

export const edgeModelColumnSchema = z.object({
  name: z.string().min(1),
  field: z.string().min(1),
  dataType: z.string().min(1),
  sequelizeType: z.string().min(1),
  allowNull: z.boolean(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  fkTarget: z.object({
    modelId: z.string().min(1),
    column: z.string().min(1),
  }).optional(),
}).strict();

const edgeModelAssociationSharedFields = {
  id: z.string().min(1),
  targetModelId: z.string().min(1),
  /** Direct FK column, or for belongsToMany the through-column pointing at the source model. */
  foreignKey: z.string().min(1),
  as: z.string().min(1),
  source: z.enum(['catalog', 'enricher', 'manual']),
} as const;

export const edgeModelAssociationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('belongsTo'),
    ...edgeModelAssociationSharedFields,
  }).strict(),
  z.object({
    kind: z.literal('hasMany'),
    ...edgeModelAssociationSharedFields,
  }).strict(),
  z.object({
    kind: z.literal('hasOne'),
    ...edgeModelAssociationSharedFields,
  }).strict(),
  z.object({
    kind: z.literal('belongsToMany'),
    ...edgeModelAssociationSharedFields,
    /** Junction Edge model id (required for many-to-many). */
    throughModelId: z.string().min(1),
    /** Through-column pointing at the target model. */
    otherKey: z.string().min(1),
  }).strict(),
]);

export const edgeModelDefinitionSchema = z.object({
  id: z.string().min(1),
  dataSourceId: z.string().min(1),
  schema: z.string().nullable(),
  objectName: z.string().min(1),
  objectType: z.enum(['TABLE', 'VIEW']),
  sequelize: z.object({
    modelName: z.string().min(1),
    tableName: z.string().min(1),
    schema: z.string().optional(),
  }).strict(),
  columns: z.array(edgeModelColumnSchema),
  primaryKey: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  associations: z.array(edgeModelAssociationSchema),
  schemaFingerprint: z.string().min(1),
  readOnly: z.boolean(),
  labels: z.object({
    title: z.string().min(1),
    /** Navigation icon ref (`pack:icon-name`), optional operator-facing glyph. */
    icon: z.string().optional(),
    /** Tailwind text color class for the model icon (e.g. `text-emerald-500`). */
    color: z.string().optional(),
  }).strict(),
  status: z.enum(['draft', 'ready', 'stale']),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();

export const edgeApiLangSourceSchema = z.enum(['query:lang', 'fixed:en', 'fixed:fa', 'fixed:ar']);

export const edgeApiEnrichmentAttachedFieldSchema = z.object({
  sourceColumn: z.string().min(1),
  outputField: z.string().min(1),
}).strict();

export const edgeApiFieldEnrichmentSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    sourceField: z.string().min(1),
    kind: z.literal('base_info_title'),
    joinTableSource: z.literal('base_info').default('base_info'),
    rootId: z.string().min(1).optional(),
    attachedFields: z.array(edgeApiEnrichmentAttachedFieldSchema).optional(),
    outputField: z.string().min(1).optional(),
    langSource: edgeApiLangSourceSchema,
    includeUiMeta: z.boolean().optional(),
  }).strict().superRefine((value, ctx) => {
    const hasAttachedFields = Boolean(value.attachedFields?.length);
    if (hasAttachedFields) {
      return;
    }

    if (!value.rootId) {
      ctx.addIssue({
        code: 'custom',
        message: 'rootId is required when attachedFields are not provided.',
        path: ['rootId'],
      });
    }

    if (!value.outputField) {
      ctx.addIssue({
        code: 'custom',
        message: 'outputField is required when attachedFields are not provided.',
        path: ['outputField'],
      });
    }
  }),
  z.object({
    id: z.string().min(1),
    sourceField: z.string().min(1),
    kind: z.literal('join_lookup'),
    joinTableSource: z.literal('edge_model'),
    targetModelId: z.string().min(1),
    targetMatchColumn: z.string().min(1),
    attachedFields: z.array(edgeApiEnrichmentAttachedFieldSchema).min(1),
  }).strict(),
]);

export const edgeApiIncludeConfigSchema = z.object({
  as: z.string().min(1),
  enabled: z.boolean(),
  limit: z.number().int().positive().optional(),
  separate: z.boolean().optional(),
  order: z.string().optional(),
  fields: z.array(z.string()).optional(),
  nestedIncludes: z.array(z.string()).optional(),
}).strict();

export const edgeApiComputedFieldSchema = z.object({
  id: z.string().min(1),
  outputField: z.string().min(1),
  kind: z.enum(['scalar_subquery', 'aggregate', 'json_path']),
  expression: z.string().min(1),
  /** JSON column name when kind is json_path. */
  sourceField: z.string().min(1).optional(),
}).strict();

export const edgeApiRuntimeSettingsSchema = z.object({
  useGlobalConfig: z.boolean(),
  timeoutMs: z.number().int().positive().optional(),
  enableLogs: z.boolean().optional(),
  cacheEnabled: z.boolean().optional(),
  cacheTtlMs: z.number().int().positive().optional(),
  cacheByParam: z.boolean().optional(),
  cacheByUser: z.boolean().optional(),
  hooks: serverFunctionHooksConfigSchema.optional(),
}).strict();

export const edgeApiBinaryPreviewSchema = z.object({
  mimeField: z.string().min(1),
  xsField: z.string().min(1),
  fullField: z.string().min(1).optional(),
  outputField: z.string().min(1),
  stripFields: z.array(z.string().min(1)).optional(),
}).strict();

export const edgeApiOperationSchema = z.object({
  id: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  kind: z.enum(['list', 'getOne', 'create', 'update', 'patch', 'delete', 'lookup', 'routine', 'pivot']),
  pathPattern: z.string().min(1),
  enabled: z.boolean(),
  fields: z.object({
    read: z.array(z.string()).optional(),
    write: z.array(z.string()).optional(),
    required: z.array(z.string()).optional(),
  }).strict().optional(),
  query: z.object({
    allowFilter: z.boolean(),
    allowSort: z.boolean(),
    maxPageSize: z.number().int().positive(),
    defaultPageSize: z.number().int().positive(),
    allowLangParam: z.boolean().optional(),
    includes: z.array(z.string()).optional(),
    views: z.record(z.string(), z.array(z.string())).optional(),
    /**
     * Preset ids from `extensions.querySurfaces` always AND-ed for this list operation
     * (in addition to presets marked `application: mandatory` on the model).
     */
    forcedPresetIds: z.array(z.string().min(1)).optional(),
    /**
     * Optional presets exposed in client UI for this list operation.
     * When omitted, all visible optional/default-on presets for the model are offered.
     */
    clientPresetIds: z.array(z.string().min(1)).optional(),
    /** When `none`, list never runs COUNT. When `exact`, always counts (ignores includeCount=false). */
    countMode: z.enum(['exact', 'none']).optional(),
    /** Used when the client omits `includeCount` (default true for backward compatibility). */
    defaultIncludeCount: z.boolean().optional(),
  }).strict().optional(),
  enrichments: z.array(edgeApiFieldEnrichmentSchema).optional(),
  includeConfigs: z.array(edgeApiIncludeConfigSchema).optional(),
  computedFields: z.array(edgeApiComputedFieldSchema).optional(),
  /** Derive a thumbnail data URL from binary columns without exposing raw bytes in list JSON. */
  binaryPreview: edgeApiBinaryPreviewSchema.optional(),
  /** When true, this operation skips Record Policy row filters even if the model scope is on. */
  bypassRecordPolicy: z.boolean().optional(),
  /** When set, this operation applies only the named policy (draft or active) instead of the model default. */
  recordPolicyId: z.string().min(1).optional(),
  /** Client metadata catalog selection for record events. Require is write-only. */
  clientContext: clientContextConfigSchema.optional(),
  routine: z.object({
    objectType: z.enum(['PROCEDURE', 'FUNCTION']),
    paramMap: z.record(z.string(), z.string()),
  }).strict().optional(),
}).strict();

export const edgeApiDefinitionSchema = z.object({
  id: z.string().min(1),
  edgeModelId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  basePath: z.string().min(1),
  operations: z.array(edgeApiOperationSchema),
  accessControl: functionAccessControlSchema,
  defaultWhere: z.record(z.string(), z.unknown()).optional(),
  openapi: z.object({
    tags: z.array(z.string()),
    summary: z.string().optional(),
  }).strict(),
  publishedAt: z.string().nullable(),
  version: z.number().int().positive(),
  runtime: edgeApiRuntimeSettingsSchema,
  managedFunctionId: z.string().optional(),
  /** Change-reason Confirm for writes of this definition. GET/list never ask. */
  changeReason: changeReasonPolicySchema.optional(),
}).strict();

export type EdgeModelColumn = z.infer<typeof edgeModelColumnSchema>;
export type EdgeModelAssociation = z.infer<typeof edgeModelAssociationSchema>;
export type EdgeModelDefinition = z.infer<typeof edgeModelDefinitionSchema>;
export type EdgeApiLangSource = z.infer<typeof edgeApiLangSourceSchema>;
export type EdgeApiFieldEnrichment = z.infer<typeof edgeApiFieldEnrichmentSchema>;
export type EdgeApiIncludeConfig = z.infer<typeof edgeApiIncludeConfigSchema>;
export type EdgeApiComputedField = z.infer<typeof edgeApiComputedFieldSchema>;
export type EdgeApiBinaryPreviewConfig = z.infer<typeof edgeApiBinaryPreviewSchema>;
export type EdgeApiRuntimeSettings = z.infer<typeof edgeApiRuntimeSettingsSchema>;
export type EdgeApiOperation = z.infer<typeof edgeApiOperationSchema>;
export type EdgeApiDefinition = z.infer<typeof edgeApiDefinitionSchema>;

export type ImportEdgeModelInput = {
  dataSourceId: string;
  schema?: string | null;
  objectName: string;
  objectType?: 'TABLE' | 'VIEW';
};

export const importEdgeModelInputSchema = z.object({
  dataSourceId: z.string().min(1),
  schema: z.string().nullable().optional(),
  objectName: z.string().min(1),
  objectType: z.enum(['TABLE', 'VIEW']).optional(),
}).strict();

export type EdgeApiListResponse<T> = {
  success: true;
  data: T[];
  count: number;
};

export type EdgeApiMutationResponse<T> = {
  success: true;
  data: T;
};

export type EdgeApiRuntimeResponse<T> = {
  success: true;
  data: T;
  count?: number;
  meta?: Record<string, unknown>;
  source?: {
    id: string;
    name: string;
    type: string;
  };
};

export const defaultEdgeApiRuntimeSettings = (): EdgeApiRuntimeSettings => ({
  useGlobalConfig: true,
});

export const defaultEdgeApiAccessControl = (): FunctionAccessControl => ({
  ...EMPTY_FUNCTION_ACCESS_CONTROL,
});
