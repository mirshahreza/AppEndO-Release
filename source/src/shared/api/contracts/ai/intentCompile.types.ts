import { z } from 'zod';

/** V4-PATCH-5 P5.3 — structured intent output for governed engineering only. */
export const GovernedIntentCompileSchema = z.object({
  governed: z.boolean(),
  promotionRequested: z.boolean().optional(),
  requestClass: z.enum(['ENGINEERING_CHANGE', 'ENGINEERING_QUERY']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type GovernedIntentCompileResult = z.infer<typeof GovernedIntentCompileSchema>;

export const GOVERNED_INTENT_COMPILE_SYSTEM = [
  'Classify whether the user request requires governed engineering (architect approval, package export, promotion).',
  'Respond with JSON only.',
  'Fields: governed (boolean), promotionRequested (boolean, optional), requestClass (ENGINEERING_CHANGE|ENGINEERING_QUERY, optional), confidence (0-1, optional).',
].join(' ');
