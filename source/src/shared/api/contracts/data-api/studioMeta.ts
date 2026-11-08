import { z } from 'zod';
import {
  edgeAssociationHistorySchema,
  edgeColumnHistorySchema,
  edgeModelHistorySchema,
} from '../record-events';
import { columnFormWidgetPropsSchema } from './columnFormWidgetProps';
import { columnFormWidgetSchema } from './columnFormWidgets';
import { columnFilterRoleSchema } from './columnFilterRole';
import { columnSearchRoleSchema } from './columnSearchRole';
import { coerceRelationFormWidget, relationFormWidgetSchema } from './relationFormWidgets';
import { relationTargetFilterConditionSchema } from './relationTargetFilter';

/** Empty / null mean “Auto (by type)” — never persist as an enum value. */
const optionalColumnFormWidgetSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  columnFormWidgetSchema.optional(),
);

/** Empty / null mean “Auto (by relation kind)” — never persist as an enum value. */
const optionalRelationFormWidgetSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }
    return coerceRelationFormWidget(value);
  },
  relationFormWidgetSchema.optional(),
);

export const edgeModelStudioColumnMetaSchema = z.object({
  columnName: z.string().min(1),
  displayLabel: z.string().optional(),
  /** Navigation icon ref (`pack:icon-name`). */
  icon: z.string().optional(),
  /** Form display widget for generated UIs. */
  formWidget: optionalColumnFormWidgetSchema,
  /** Widget-specific settings (min/max, code language, options, …). */
  formWidgetProps: columnFormWidgetPropsSchema.optional(),
  /**
   * Whether the column is required in generated forms.
   * Non-nullable schema columns are always required in the UI (forced checked + disabled);
   * persist only when true for nullable columns.
   */
  required: z.boolean().optional(),
  /** List search participation: basic, advanced, or none. */
  searchRole: columnSearchRoleSchema.optional(),
  /** List Where builder participation: public, restricted, or none. */
  filterRole: columnFilterRoleSchema.optional(),
  /** Internal notes for builders / implementation. */
  developerNotes: z.string().optional(),
  /** Operator / UI-facing notes (hints, help copy). */
  interfaceNotes: z.string().optional(),
  group: z.string().optional(),
  sortOrder: z.number().int().optional(),
  cubeMeasure: z.object({
    aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'countDistinct', 'lastNonEmpty']),
    additivity: z.enum(['additive', 'semi-additive']),
    semiAdditiveOverAssociation: z.string().min(1).optional(),
  }).strict().optional(),
  history: edgeColumnHistorySchema.optional(),
}).strict();

/** Extra columns pulled from the association target for generated UIs / API shaping. */
export const edgeModelStudioAssociationAttachedFieldSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const row = value as Record<string, unknown>;
    const sourceColumn = typeof row.sourceColumn === 'string' ? row.sourceColumn.trim() : '';
    const asName = typeof row.as === 'string' ? row.as.trim() : '';
    // Older studio-meta rows only stored sourceColumn — treat it as the output name until edited.
    if (sourceColumn && !asName) {
      return { ...row, as: sourceColumn };
    }
    return value;
  },
  z.object({
    sourceColumn: z.string().min(1),
    /** Output / include field name (default: `{fk}_{sourceColumn}`). */
    as: z.string().min(1),
  }).strict(),
);

/** Studio metadata for a relation (logical association id, or physical row key). */
export const edgeModelStudioAssociationMetaSchema = z.object({
  relationKey: z.string().min(1),
  displayLabel: z.string().optional(),
  /** Navigation icon ref (`pack:icon-name`). */
  icon: z.string().optional(),
  /** Form display widget for generated UIs. */
  formWidget: optionalRelationFormWidgetSchema,
  /** Target-table columns attached for interface / enrichment guidance. */
  attachedFields: z.array(edgeModelStudioAssociationAttachedFieldSchema).optional(),
  /**
   * Static AND filter on the target model for form pickers / lookups
   * (e.g. active = true, parent_id is null).
   */
  targetFilter: z.array(relationTargetFilterConditionSchema).optional(),
  /** Internal notes for builders / implementation. */
  developerNotes: z.string().optional(),
  /** Operator / UI-facing notes (hints, help copy). */
  interfaceNotes: z.string().optional(),
  cubeDimension: z.object({
    hierarchies: z.array(z.object({
      name: z.string().min(1),
      levels: z.array(z.string().min(1)),
    }).strict()).optional(),
    attributes: z.array(z.string().min(1)).optional(),
    isTimeDimension: z.boolean().optional(),
  }).strict().optional(),
  history: edgeAssociationHistorySchema.optional(),
}).strict();

export const edgeModelStudioMetaSchema = z.object({
  edgeModelId: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  columnMeta: z.array(edgeModelStudioColumnMetaSchema).default([]),
  associationMeta: z.array(edgeModelStudioAssociationMetaSchema).default([]),
  history: edgeModelHistorySchema.optional(),
  /** Extensible bag for future modeler definitions. */
  extensions: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();

export type EdgeModelStudioColumnMeta = z.infer<typeof edgeModelStudioColumnMetaSchema>;
export type EdgeModelStudioAssociationMeta = z.infer<typeof edgeModelStudioAssociationMetaSchema>;
export type EdgeModelStudioMeta = z.infer<typeof edgeModelStudioMetaSchema>;

export const upsertEdgeModelStudioMetaInputSchema = z.object({
  tags: z.array(z.string()).optional(),
  columnMeta: z.array(edgeModelStudioColumnMetaSchema).optional(),
  associationMeta: z.array(edgeModelStudioAssociationMetaSchema).optional(),
  history: edgeModelHistorySchema.optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpsertEdgeModelStudioMetaInput = z.infer<typeof upsertEdgeModelStudioMetaInputSchema>;

export const createEmptyEdgeModelStudioMeta = (edgeModelId: string): EdgeModelStudioMeta => {
  const now = new Date().toISOString();
  return {
    edgeModelId,
    tags: [],
    columnMeta: [],
    associationMeta: [],
    extensions: {},
    created_at: now,
    updated_at: now,
  };
};

export const CUBE_DERIVED_MEASURES_EXTENSION_KEY = 'cubeDerivedMeasures';

export const cubeDerivedMeasureSchema = z.object({
  name: z.string().min(1),
  operation: z.enum(['ratio', 'difference', 'percentDiff']),
  numerator: z.string().min(1),
  denominator: z.string().min(1),
}).strict();

export type CubeDerivedMeasureDef = z.infer<typeof cubeDerivedMeasureSchema>;

export const parseCubeDerivedMeasures = (
  extensions: Record<string, unknown> | undefined,
): CubeDerivedMeasureDef[] => {
  const raw = extensions?.[CUBE_DERIVED_MEASURES_EXTENSION_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    const parsed = cubeDerivedMeasureSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
};
