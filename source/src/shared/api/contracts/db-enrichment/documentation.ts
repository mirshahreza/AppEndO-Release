import { z } from 'zod';
import { dbEnrichmentConfidenceBasisSchema, dbEnrichmentSourceOfTruthSchema, dbEnrichmentValueGlossaryEntrySchema } from './knowledge';
import { dbEnrichmentQuestionSchema } from './question';

export const dbEnrichmentDocumentationColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string(),
  isPrimaryKey: z.boolean(),
  meaning: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  confidenceBasis: dbEnrichmentConfidenceBasisSchema.nullable(),
  valueGlossary: z.array(dbEnrichmentValueGlossaryEntrySchema).optional(),
}).strict();
export type DbEnrichmentDocumentationColumn = z.infer<typeof dbEnrichmentDocumentationColumnSchema>;

export const dbEnrichmentDocumentationRelationSchema = z.object({
  fromColumn: z.string().min(1),
  toTable: z.string().min(1),
  toColumn: z.string().min(1),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
}).strict();
export type DbEnrichmentDocumentationRelation = z.infer<typeof dbEnrichmentDocumentationRelationSchema>;

export const dbEnrichmentDocumentationObjectSchema = z.object({
  objectType: z.enum(['TABLE', 'VIEW']),
  objectName: z.string().min(1),
  purpose: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  sourceOfTruth: dbEnrichmentSourceOfTruthSchema.nullable(),
  columns: z.array(dbEnrichmentDocumentationColumnSchema).default([]),
  relations: z.array(dbEnrichmentDocumentationRelationSchema).default([]),
}).strict();
export type DbEnrichmentDocumentationObject = z.infer<typeof dbEnrichmentDocumentationObjectSchema>;

export const dbEnrichmentDocumentationSchema = z.object({
  dataSourceId: z.string().min(1),
  dataSourceName: z.string(),
  dataSourceType: z.string(),
  generatedAt: z.string(),
  tablesTotal: z.number(),
  tablesEnriched: z.number(),
  overallConfidence: z.number().min(0).max(1).nullable(),
  openQuestionCount: z.number(),
  objects: z.array(dbEnrichmentDocumentationObjectSchema).default([]),
  questions: z.array(dbEnrichmentQuestionSchema).default([]),
}).strict();
export type DbEnrichmentDocumentation = z.infer<typeof dbEnrichmentDocumentationSchema>;
