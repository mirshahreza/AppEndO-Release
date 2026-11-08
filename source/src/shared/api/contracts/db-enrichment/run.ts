import { z } from 'zod';

export const dbEnrichmentScopeSchema = z.enum(['FULL', 'TABLES']);
export type DbEnrichmentScope = z.infer<typeof dbEnrichmentScopeSchema>;

export const dbEnrichmentRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type DbEnrichmentRunStatus = z.infer<typeof dbEnrichmentRunStatusSchema>;

export const triggerDbEnrichmentInputSchema = z.object({
  dataSourceId: z.string().min(1),
  scope: dbEnrichmentScopeSchema.default('FULL'),
  tables: z.array(z.string().min(1)).optional(),
  modelId: z.string().min(1).optional(),
}).strict();
export type TriggerDbEnrichmentInput = z.infer<typeof triggerDbEnrichmentInputSchema>;

export const dbEnrichmentProgressLogEntrySchema = z.object({
  at: z.string(),
  message: z.string(),
}).strict();
export type DbEnrichmentProgressLogEntry = z.infer<typeof dbEnrichmentProgressLogEntrySchema>;

export const dbEnrichmentRunSchema = z.object({
  id: z.number(),
  dataSourceId: z.string(),
  scope: dbEnrichmentScopeSchema,
  status: dbEnrichmentRunStatusSchema,
  jobId: z.number().nullable(),
  modelId: z.string().nullable(),
  tablesTotal: z.number(),
  tablesProcessed: z.number(),
  columnsResolved: z.number(),
  columnsAmbiguous: z.number(),
  questionsCreated: z.number(),
  overallConfidence: z.number().nullable(),
  progressLog: z.array(dbEnrichmentProgressLogEntrySchema).default([]),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
}).strict();
export type DbEnrichmentRun = z.infer<typeof dbEnrichmentRunSchema>;

export const dbEnrichmentMetricsSchema = z.object({
  dataSourceId: z.string(),
  tablesTotal: z.number(),
  tablesEnriched: z.number(),
  coverage: z.number(),
  overallConfidence: z.number().nullable(),
  openQuestionCount: z.number(),
  columnsResolved: z.number(),
  columnsAmbiguous: z.number(),
  humanShare: z.number(),
  /** ISO timestamp of the last completed enrichment run (`finishedAt`). */
  enrichedAt: z.string().nullable(),
  lastRun: dbEnrichmentRunSchema.nullable(),
}).strict();
export type DbEnrichmentMetrics = z.infer<typeof dbEnrichmentMetricsSchema>;
