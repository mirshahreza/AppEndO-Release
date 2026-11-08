import { z } from 'zod';
import { jsonValueSchema, jsonSchemaRefOrInlineSchema, exactActionRefSchema } from '../awm/schemas';

export const actionContributorTypeSchema = z.enum(['CORE', 'PLATFORM', 'PACKAGE']);
export const actionExecutionModeSchema = z.enum(['DETERMINISTIC', 'AGENTIC']);

export const agenticActionConstraintsSchema = z.strictObject({
  allowedToolActionRefs: z.array(exactActionRefSchema),
  allowedOutcomeKeys: z.array(z.string().min(1)).optional(),
  maximumTurns: z.number().int().positive(),
  maximumToolCalls: z.number().int().positive(),
  memoryPolicy: z.enum(['NONE', 'GOVERNED_EXTERNAL_RESOURCE']),
});

export const actionDefinitionSchema = z
  .strictObject({
    key: z.string().min(1),
    version: z.string().min(1),
    contributor: z.strictObject({ type: actionContributorTypeSchema, id: z.string().min(1) }),
    configSchema: jsonSchemaRefOrInlineSchema,
    inputSchema: jsonSchemaRefOrInlineSchema,
    outputSchema: jsonSchemaRefOrInlineSchema,
    uiSchema: jsonValueSchema.optional(),
    executionTimeoutMs: z.number().int().positive(),
    idempotency: z.strictObject({
      guarantee: z.enum(['DEDUPLICATED', 'SUPPORTED', 'BEST_EFFORT', 'NONE']),
      deduplicationWindowMs: z.number().int().positive().optional(),
    }),
    cancellationSupport: z.enum(['SUPPORTED', 'NONE']),
    sideEffectClass: z.enum(['PURE', 'READ_EXTERNAL', 'WRITE_EXTERNAL']),
    riskClass: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    requiredCapabilities: z.array(z.string().min(1)),
    requiredPermissions: z.array(z.string().min(1)),
    secretReferenceFields: z.array(z.string().min(1)),
    availability: z.enum(['AVAILABLE', 'UNAVAILABLE']),
    executionMode: actionExecutionModeSchema,
    agenticConstraints: agenticActionConstraintsSchema.optional(),
    registryPriority: z.number().int().nonnegative().optional(),
    tags: z.array(z.string().min(1)),
  })
  .check((ctx) => {
    const def = ctx.value;
    // Doc 04 section 11: DEDUPLICATED requires a positive window; other guarantees MUST omit it.
    if (def.idempotency.guarantee === 'DEDUPLICATED' && def.idempotency.deduplicationWindowMs === undefined) {
      ctx.issues.push({ code: 'custom', message: 'DEDUPLICATED idempotency requires deduplicationWindowMs.', input: def, path: ['idempotency', 'deduplicationWindowMs'] });
    }
    if (def.idempotency.guarantee !== 'DEDUPLICATED' && def.idempotency.deduplicationWindowMs !== undefined) {
      ctx.issues.push({ code: 'custom', message: 'Only DEDUPLICATED idempotency may declare deduplicationWindowMs.', input: def, path: ['idempotency', 'deduplicationWindowMs'] });
    }
    // AGENTIC requires agenticConstraints; DETERMINISTIC MUST omit them.
    if (def.executionMode === 'AGENTIC' && def.agenticConstraints === undefined) {
      ctx.issues.push({ code: 'custom', message: 'AGENTIC executionMode requires agenticConstraints.', input: def, path: ['agenticConstraints'] });
    }
    if (def.executionMode === 'DETERMINISTIC' && def.agenticConstraints !== undefined) {
      ctx.issues.push({ code: 'custom', message: 'DETERMINISTIC executionMode must omit agenticConstraints.', input: def, path: ['agenticConstraints'] });
    }
  });
