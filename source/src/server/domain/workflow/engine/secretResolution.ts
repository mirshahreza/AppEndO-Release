import { WorkflowDomainError } from '../errors';
import { resolveWorkflowCredentialValue } from '../workflowSecretReferenceRepository';
import type { JsonValue } from '../awm/types';

/**
 * Doc 04 section 8 / doc 09 (deferred) — the governed `resolveSecret` channel. p-99/WFT-3 added a
 * real encrypted value (`workflowCredentialCrypto.ts` / shared `credentialCrypto.ts`): a reference now resolves its stored,
 * decrypted value first, falling back to the original Option 1 behavior
 * (`process.env[name]`) unchanged when no value is stored — every reference created before this
 * feature keeps working exactly as before. `secretReferenceFields` (doc 04 section 7) marks which
 * evaluated config/input subtrees hold secret-reference strings; publish-time validation
 * (`actionResolutionValidation.ts`) already forces every leaf under those subtrees to be
 * non-literal (referenced indirectly via an expression), so by the time dispatch reaches here each
 * string leaf is an author-supplied *reference name*, not a hardcoded secret.
 */
export async function resolveWorkflowSecretFromEnv(secretRef: string): Promise<string> {
  const key = secretRef.trim();
  if (!key) {
    throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', 'Empty secret reference cannot be resolved.', {});
  }
  const value = await resolveWorkflowCredentialValue(key);
  if (!value) {
    throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', `Secret reference "${key}" did not resolve to a stored vault value or a configured environment variable.`, { secretRef: key });
  }
  return value;
}

function getAtPath(root: JsonValue, segments: string[]): JsonValue | undefined {
  let current: JsonValue = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    const next = (current as Record<string, JsonValue>)[segment];
    if (next === undefined) return undefined;
    current = next;
  }
  return current;
}

function setAtPath(root: JsonValue, segments: string[], replacement: JsonValue): JsonValue {
  if (segments.length === 0) return replacement;
  if (root === null || typeof root !== 'object' || Array.isArray(root)) return root;
  const [head, ...rest] = segments;
  const obj = root as Record<string, JsonValue>;
  if (!(head in obj)) return root;
  return { ...obj, [head]: rest.length === 0 ? replacement : setAtPath(obj[head], rest, replacement) };
}

/** Every string leaf under a `secretReferenceFields` subtree is a reference name, never a raw value — recurse through objects/arrays, resolving each string leaf and leaving numbers/booleans/null untouched. */
async function substituteSecretReferences(value: JsonValue, resolveSecret: (secretRef: string) => Promise<string>): Promise<JsonValue> {
  if (typeof value === 'string') return resolveSecret(value);
  if (Array.isArray(value)) return Promise.all(value.map((item) => substituteSecretReferences(item, resolveSecret)));
  if (value !== null && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, field]) => [key, await substituteSecretReferences(field, resolveSecret)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}

/** Resolves every `secretReferenceFields` pointer (doc 04 section 7, e.g. "config.headers") against the already-evaluated `config`/`actionInput`, replacing the subtree found at each pointer in place. A pointer that resolves to nothing (field omitted by the author) is skipped, not an error — `secretReferenceFields` marks where secrets MAY live, not that they must. */
export async function applySecretReferenceFields(input: {
  config: JsonValue;
  actionInput: JsonValue;
  secretReferenceFields: string[];
  resolveSecret: (secretRef: string) => Promise<string>;
}): Promise<{ config: JsonValue; actionInput: JsonValue }> {
  let config = input.config;
  let actionInput = input.actionInput;
  for (const pointer of input.secretReferenceFields) {
    const [rootName, ...rest] = pointer.split('.');
    if (rootName === 'config') {
      const subtree = getAtPath(config, rest);
      if (subtree === undefined) continue;
      const resolved = await substituteSecretReferences(subtree, input.resolveSecret);
      config = rest.length === 0 ? resolved : setAtPath(config, rest, resolved);
    } else if (rootName === 'input') {
      const subtree = getAtPath(actionInput, rest);
      if (subtree === undefined) continue;
      const resolved = await substituteSecretReferences(subtree, input.resolveSecret);
      actionInput = rest.length === 0 ? resolved : setAtPath(actionInput, rest, resolved);
    }
  }
  return { config, actionInput };
}
