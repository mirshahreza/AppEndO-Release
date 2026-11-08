import { z } from 'zod';

export const dbEnrichmentConfidenceBasisSchema = z.enum([
  'human_authored',
  'human_answered',
  'fk_lookup_sampled',
  'value_sampled',
  'name_pattern_only',
  'unresolved',
]);
export type DbEnrichmentConfidenceBasis = z.infer<typeof dbEnrichmentConfidenceBasisSchema>;

export const DB_ENRICHMENT_CONFIDENCE_BY_BASIS: Record<DbEnrichmentConfidenceBasis, number> = {
  human_authored: 1,
  human_answered: 1,
  fk_lookup_sampled: 0.9,
  value_sampled: 0.7,
  name_pattern_only: 0.4,
  unresolved: 0,
};

export const dbEnrichmentValueGlossaryEntrySchema = z.object({
  value: z.string(),
  meaning: z.string(),
}).strict();

export const dbEnrichmentColumnKnowledgeSchema = z.object({
  columnName: z.string().min(1),
  meaning: z.string(),
  confidence: z.number().min(0).max(1),
  confidenceBasis: dbEnrichmentConfidenceBasisSchema,
  valueGlossary: z.array(dbEnrichmentValueGlossaryEntrySchema).optional(),
  sampledAt: z.string().optional(),
}).strict();
export type DbEnrichmentColumnKnowledge = z.infer<typeof dbEnrichmentColumnKnowledgeSchema>;

export const dbEnrichmentRelationKnowledgeSchema = z.object({
  fromColumn: z.string().min(1),
  toTable: z.string().min(1),
  toColumn: z.string().min(1),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
}).strict();
export type DbEnrichmentRelationKnowledge = z.infer<typeof dbEnrichmentRelationKnowledgeSchema>;

export const dbEnrichmentSourceOfTruthSchema = z.enum(['HUMAN', 'INFERRED', 'MIXED']);
export type DbEnrichmentSourceOfTruth = z.infer<typeof dbEnrichmentSourceOfTruthSchema>;

export const dbEnrichmentKnowledgeSchema = z.object({
  dataSourceId: z.string().min(1),
  objectType: z.enum(['TABLE', 'VIEW']),
  objectName: z.string().min(1),
  tablePurpose: z.string().nullable().optional(),
  tableConfidence: z.number().min(0).max(1).nullable().optional(),
  columns: z.array(dbEnrichmentColumnKnowledgeSchema).default([]),
  relations: z.array(dbEnrichmentRelationKnowledgeSchema).default([]),
  sourceOfTruth: dbEnrichmentSourceOfTruthSchema.default('INFERRED'),
  lastEnrichedRunId: z.number().nullable().optional(),
  staleSince: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
}).strict();
export type DbEnrichmentKnowledge = z.infer<typeof dbEnrichmentKnowledgeSchema>;
