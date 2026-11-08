import { z } from 'zod';
import { PRESET_SCOPE_DIMENSION_KEYS } from './constants';
import { recordPolicyTreeNodeSchema } from './tree';

export const SCOPE_DIMENSION_TOPOLOGIES = ['flat', 'tree'] as const;
export type ScopeDimensionTopology = (typeof SCOPE_DIMENSION_TOPOLOGIES)[number];

export const scopeDimensionTopologySchema = z.enum(SCOPE_DIMENSION_TOPOLOGIES);

export const RECORD_SCOPE_MODES = ['off', 'on'] as const;
export type RecordScopeMode = (typeof RECORD_SCOPE_MODES)[number];

export const recordScopeModeSchema = z.enum(RECORD_SCOPE_MODES);

export const scopeDimensionDefSchema = z.object({
  key: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  label: z.string().min(1),
  topology: scopeDimensionTopologySchema,
  /** Base Info root / category id that supplies nodes (D2). */
  baseInfoRootId: z.string().min(1),
  enabled: z.boolean().default(true),
  preset: z.enum([
    PRESET_SCOPE_DIMENSION_KEYS.org,
    PRESET_SCOPE_DIMENSION_KEYS.geo,
  ]).optional(),
  updatedAt: z.string().optional(),
}).strict();

export type ScopeDimensionDef = z.infer<typeof scopeDimensionDefSchema>;

export const scopeFieldBindingSchema = z.object({
  field: z.string().min(1),
  dimensionKey: z.string().min(1),
}).strict();

export type ScopeFieldBinding = z.infer<typeof scopeFieldBindingSchema>;

/** Per-model sidecar: `workspace/record-policy-bindings/{edgeModelId}.json` */
export const recordPolicyBindingDocumentSchema = z.object({
  edgeModelId: z.string().min(1),
  recordScope: recordScopeModeSchema.default('off'),
  forceScopeForAdmin: z.boolean().default(false),
  /** Optional owner field for “mine only” templates. */
  ownerField: z.string().min(1).optional(),
  bindings: z.array(scopeFieldBindingSchema).default([]),
  /** Allowlisted `user.*` context keys (without prefix) for this model’s policies. */
  allowedUserAttrKeys: z.array(z.string().min(1)).default([]),
  /** AND/OR tree of policy ids. Missing tree ⇒ AND of every policy on the model. */
  policyTree: recordPolicyTreeNodeSchema.optional(),
  updatedAt: z.string().optional(),
}).strict();

export type RecordPolicyBindingDocument = z.infer<typeof recordPolicyBindingDocumentSchema>;

export const normalizeRecordPolicyBindingDocument = (
  input: unknown,
): { ok: true; binding: RecordPolicyBindingDocument } | { ok: false; message: string } => {
  const parsed = recordPolicyBindingDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid record policy binding',
    };
  }

  const doc = parsed.data;
  const seenDims = new Set<string>();
  const bindings: ScopeFieldBinding[] = [];
  for (const row of doc.bindings) {
    const field = row.field.trim();
    const dimensionKey = row.dimensionKey.trim();
    if (!field || !dimensionKey) {
      continue;
    }
    const dedupeKey = `${field}::${dimensionKey}`;
    if (seenDims.has(dedupeKey)) {
      continue;
    }
    seenDims.add(dedupeKey);
    bindings.push({ field, dimensionKey });
  }

  return {
    ok: true,
    binding: {
      ...doc,
      edgeModelId: doc.edgeModelId.trim(),
      ownerField: doc.ownerField?.trim() || undefined,
      bindings,
      allowedUserAttrKeys: [...new Set(doc.allowedUserAttrKeys.map((key) => key.trim()).filter(Boolean))],
    },
  };
};

export const normalizeScopeDimensionDef = (
  input: unknown,
): { ok: true; dimension: ScopeDimensionDef } | { ok: false; message: string } => {
  const parsed = scopeDimensionDefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid scope dimension',
    };
  }
  return {
    ok: true,
    dimension: {
      ...parsed.data,
      key: parsed.data.key.trim(),
      label: parsed.data.label.trim(),
      baseInfoRootId: parsed.data.baseInfoRootId.trim(),
    },
  };
};

/** Membership row shape (Prisma-backed; contract for APIs / SessionScope). */
export const scopeMembershipSchema = z.object({
  userId: z.union([z.string(), z.number(), z.bigint()]),
  dimensionKey: z.string().min(1),
  nodeId: z.string().min(1),
}).strict();

export type ScopeMembership = z.infer<typeof scopeMembershipSchema>;
