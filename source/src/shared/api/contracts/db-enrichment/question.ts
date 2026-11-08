import { z } from 'zod';

export const dbEnrichmentQuestionKindSchema = z.enum([
  'column_meaning',
  'value_glossary',
  'relation_intent',
  'table_purpose',
]);
export type DbEnrichmentQuestionKind = z.infer<typeof dbEnrichmentQuestionKindSchema>;

export const dbEnrichmentQuestionStatusSchema = z.enum(['open', 'answered', 'dismissed']);
export type DbEnrichmentQuestionStatus = z.infer<typeof dbEnrichmentQuestionStatusSchema>;

export const dbEnrichmentQuestionSchema = z.object({
  id: z.number(),
  dataSourceId: z.string(),
  runId: z.number().nullable(),
  objectType: z.enum(['TABLE', 'VIEW']),
  objectName: z.string(),
  columnName: z.string().nullable(),
  kind: dbEnrichmentQuestionKindSchema,
  question: z.string(),
  reason: z.array(z.string()).default([]),
  candidates: z.array(z.string()).default([]),
  status: dbEnrichmentQuestionStatusSchema,
  answer: z.string().nullable(),
  answeredBy: z.number().nullable(),
  answeredAt: z.string().nullable(),
  createdAt: z.string().nullable(),
}).strict();
export type DbEnrichmentQuestion = z.infer<typeof dbEnrichmentQuestionSchema>;

export const answerDbEnrichmentQuestionInputSchema = z.object({
  answer: z.string().min(1),
}).strict();
export type AnswerDbEnrichmentQuestionInput = z.infer<typeof answerDbEnrichmentQuestionInputSchema>;

export const draftDbEnrichmentQuestionInputSchema = z.object({
  modelId: z.string().min(1).optional(),
}).strict();
export type DraftDbEnrichmentQuestionInput = z.infer<typeof draftDbEnrichmentQuestionInputSchema>;

export const dismissDbEnrichmentQuestionInputSchema = z.object({}).strict();
