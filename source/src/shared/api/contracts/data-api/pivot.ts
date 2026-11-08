import { z } from 'zod';

export const PIVOT_AGGREGATIONS = [
  'sum',
  'count',
  'avg',
  'min',
  'max',
  'countDistinct',
] as const;

export type PivotAggregation = (typeof PIVOT_AGGREGATIONS)[number];

export const PIVOT_SOURCE_KINDS = [
  'flat-sql',
  'star-schema',
  'olap-bridge',
  'mongo-aggregation',
  'elasticsearch-aggregation',
] as const;

export type PivotSourceKind = (typeof PIVOT_SOURCE_KINDS)[number];

export const DEFAULT_PIVOT_CELL_CAP = 10_000;
export const DEFAULT_PIVOT_CACHE_TTL_MS = 60_000;
export const DEFAULT_PIVOT_TIMEOUT_MS = 30_000;

export const PIVOT_DATE_GRAINS = ['day', 'hour', 'month'] as const;
export type PivotDateGrain = (typeof PIVOT_DATE_GRAINS)[number];

const pivotAxisFieldSchema = z.object({
  field: z.string().min(1),
  grain: z.enum(PIVOT_DATE_GRAINS).optional(),
}).strict();

export const pivotMeasureSchema = z.object({
  field: z.string().min(1),
  aggregation: z.enum(PIVOT_AGGREGATIONS),
}).strict();

export const pivotFilterDslSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
);

export const pivotSourceSchema = z.object({
  kind: z.enum(PIVOT_SOURCE_KINDS),
  dataSourceId: z.string().min(1).optional(),
  catalog: z.string().min(1).optional(),
  cube: z.string().min(1).optional(),
  collection: z.string().min(1).optional(),
  index: z.string().min(1).optional(),
}).strict();

export const pivotSpecSchema = z.object({
  rows: z.array(pivotAxisFieldSchema).default([]),
  columns: z.array(pivotAxisFieldSchema).default([]),
  measures: z.array(pivotMeasureSchema).min(1),
  filters: pivotFilterDslSchema.optional(),
  totals: z.object({
    rows: z.boolean().optional(),
    columns: z.boolean().optional(),
  }).strict().optional(),
  source: pivotSourceSchema.optional(),
  noCache: z.boolean().optional(),
}).strict();

export const pivotAxisMemberSchema = z.object({
  key: z.string(),
  labels: z.array(z.unknown()),
}).strict();

export const pivotResultSchema = z.object({
  rowAxis: z.object({
    fields: z.array(z.string()),
    members: z.array(pivotAxisMemberSchema),
  }).strict(),
  colAxis: z.object({
    fields: z.array(z.string()),
    members: z.array(pivotAxisMemberSchema),
  }).strict(),
  measures: z.array(z.object({
    field: z.string(),
    aggregation: z.string(),
  }).strict()),
  cells: z.array(z.object({
    rowKey: z.string(),
    colKey: z.string(),
    values: z.array(z.number().nullable()),
  }).strict()),
}).strict();

export type PivotSpec = z.infer<typeof pivotSpecSchema>;
export type PivotResult = z.infer<typeof pivotResultSchema>;

export const PIVOT_EMPTY_MEMBER_KEY = '__all__';
export const PIVOT_TOTAL_MEMBER_KEY = '__total__';

export const parsePivotSpec = (value: unknown): PivotSpec => pivotSpecSchema.parse(value);

export const emptyPivotResult = (spec: Pick<PivotSpec, 'rows' | 'columns' | 'measures'>): PivotResult => ({
  rowAxis: {
    fields: spec.rows.map((item) => item.field),
    members: [{ key: PIVOT_EMPTY_MEMBER_KEY, labels: [] }],
  },
  colAxis: {
    fields: spec.columns.map((item) => item.field),
    members: [{ key: PIVOT_EMPTY_MEMBER_KEY, labels: [] }],
  },
  measures: spec.measures.map((item) => ({ field: item.field, aggregation: item.aggregation })),
  cells: [],
});

export const encodePivotMemberKey = (labels: unknown[]): string => (
  labels.length === 0
    ? PIVOT_EMPTY_MEMBER_KEY
    : labels.map((label) => (label == null ? '' : String(label))).join('\u001f')
);

export const countPivotCells = (result: PivotResult): number => result.cells.length;
