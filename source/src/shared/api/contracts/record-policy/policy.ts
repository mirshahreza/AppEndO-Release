import { z } from 'zod';
import { recordPolicyPredicateNodeSchema, type RecordPolicyPredicateNode } from './predicate';

export const RECORD_POLICY_ACTIONS = [
  'list',
  'read',
  'create',
  'update',
  'delete',
] as const;

export type RecordPolicyAction = (typeof RECORD_POLICY_ACTIONS)[number];

export const recordPolicyActionSchema = z.enum(RECORD_POLICY_ACTIONS);

export const RECORD_POLICY_EFFECTS = ['allow', 'deny'] as const;
export type RecordPolicyEffect = (typeof RECORD_POLICY_EFFECTS)[number];

export const recordPolicyEffectSchema = z.enum(RECORD_POLICY_EFFECTS);

export const recordPolicyPrincipalsSchema = z.object({
  roles: z.array(z.string().min(1)).default([]),
  users: z.array(z.string().min(1)).default([]),
}).strict();

export type RecordPolicyPrincipals = z.infer<typeof recordPolicyPrincipalsSchema>;

export const recordPolicyDocumentSchema = z.object({
  id: z.string().min(1),
  edgeModelId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  effect: recordPolicyEffectSchema.default('allow'),
  principals: recordPolicyPrincipalsSchema,
  predicate: recordPolicyPredicateNodeSchema,
  enabled: z.boolean().default(true),
  version: z.number().int().nonnegative().default(1),
  updatedAt: z.string().optional(),
}).strict();

export type RecordPolicyDocument = z.infer<typeof recordPolicyDocumentSchema>;

const normalizePrincipalList = (values: readonly string[], kind: 'roles' | 'users'): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = kind === 'roles' ? trimmed.toUpperCase() : trimmed;
    const key = kind === 'roles' ? normalized : normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

/**
 * Normalize policy document: trim ids, exclusive role/user casing.
 * Scope applies to every Data API kind on the model — policies have no per-action list.
 */
export const normalizeRecordPolicyDocument = (
  input: unknown,
): { ok: true; policy: RecordPolicyDocument } | { ok: false; message: string } => {
  const parsed = recordPolicyDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid record policy',
    };
  }

  const doc = parsed.data;
  const roles = normalizePrincipalList(doc.principals.roles, 'roles');
  const users = normalizePrincipalList(doc.principals.users, 'users');

  const policy: RecordPolicyDocument = {
    ...doc,
    id: doc.id.trim(),
    edgeModelId: doc.edgeModelId.trim(),
    name: doc.name.trim(),
    description: doc.description?.trim() || undefined,
    effect: 'allow',
    principals: { roles, users },
    predicate: doc.predicate as RecordPolicyPredicateNode,
    enabled: doc.enabled,
    version: doc.version,
  };

  return { ok: true, policy };
};

/** True when principal lists are empty — matches any authenticated principal (template convenience). */
export const recordPolicyMatchesAnyPrincipal = (principals: RecordPolicyPrincipals): boolean => (
  principals.roles.length === 0 && principals.users.length === 0
);
