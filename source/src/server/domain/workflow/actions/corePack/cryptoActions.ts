import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/**
 * Crypto Action pack (WFV2-9). Node's built-in `crypto` module is a real, always-available
 * platform primitive — no new dependency, no Repository Reality Audit gap (unlike `text.regex-match`
 * before `safeRegex.ts` existed). Scope is deliberately narrow: hashing/HMAC only (data-integrity
 * use cases named in the plan — signing a payload for a downstream system, checksum verification).
 * Encryption/decryption is explicitly out of scope here — that needs a key-management story
 * (rotation, at-rest secret storage) this Action pack does not attempt to invent.
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const ALGORITHM_ENUM = ['sha256', 'sha384', 'sha512', 'sha1', 'md5'];
const ENCODING_ENUM = ['hex', 'base64'];

const baseDefinition = (key: string): Omit<ActionDefinition, 'key'> => ({
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema(),
  outputSchema: inlineSchema(),
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['crypto'],
}) as unknown as Omit<ActionDefinition, 'key'>;

/** Node's OpenSSL binding rejects unknown digest names at `createHash`/`createHmac` call time anyway; this allowlist exists to give authors a clear, closed, documented set instead of relying on that runtime error. */
const ALLOWED_ALGORITHMS = new Set(['sha256', 'sha384', 'sha512', 'sha1', 'md5']);

const resolveAlgorithm = (value: unknown): string | null => {
  const algo = typeof value === 'string' ? value.toLowerCase() : 'sha256';
  return ALLOWED_ALGORITHMS.has(algo) ? algo : null;
};

const resolveEncoding = (value: unknown): 'hex' | 'base64' => (value === 'base64' ? 'base64' : 'hex');

export const cryptoHashDefinition: ActionDefinition = {
  key: 'crypto.hash',
  ...baseDefinition('crypto.hash'),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      algorithm: { type: 'string', enum: ALGORITHM_ENUM, default: 'sha256' },
      data: { type: 'string', description: 'The text to hash.' },
      encoding: { type: 'string', title: 'Output encoding', enum: ENCODING_ENUM, default: 'hex' },
    },
    required: ['data'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { digest: { type: 'string' }, algorithm: { type: 'string' } } }),
};
export const cryptoHashExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { algorithm, data, encoding } = (input ?? {}) as { algorithm?: unknown; data?: unknown; encoding?: unknown };
    const algo = resolveAlgorithm(algorithm);
    if (!algo) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Unsupported hash algorithm. Allowed: ${[...ALLOWED_ALGORITHMS].join(', ')}.` };
    }
    if (typeof data !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.data (string).' };
    }
    const digest = createHash(algo).update(data, 'utf8').digest(resolveEncoding(encoding));
    return { status: 'SUCCEEDED', output: { digest, algorithm: algo } };
  },
};

export const cryptoHmacDefinition: ActionDefinition = {
  key: 'crypto.hmac',
  ...baseDefinition('crypto.hmac'),
  riskClass: 'MEDIUM',
  secretReferenceFields: ['input.key'],
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      algorithm: { type: 'string', enum: ALGORITHM_ENUM, default: 'sha256' },
      data: { type: 'string', description: 'The text to sign.' },
      key: { type: 'string', title: 'Secret key', description: 'The HMAC secret key.' },
      encoding: { type: 'string', title: 'Output encoding', enum: ENCODING_ENUM, default: 'hex' },
    },
    required: ['data', 'key'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { digest: { type: 'string' }, algorithm: { type: 'string' } } }),
};
export const cryptoHmacExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { algorithm, data, key, encoding } = (input ?? {}) as { algorithm?: unknown; data?: unknown; key?: unknown; encoding?: unknown };
    const algo = resolveAlgorithm(algorithm);
    if (!algo) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Unsupported HMAC algorithm. Allowed: ${[...ALLOWED_ALGORITHMS].join(', ')}.` };
    }
    if (typeof data !== 'string' || typeof key !== 'string' || key.length === 0) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.data (string) and input.key (non-empty string).' };
    }
    const digest = createHmac(algo, key).update(data, 'utf8').digest(resolveEncoding(encoding));
    return { status: 'SUCCEEDED', output: { digest, algorithm: algo } };
  },
};

export const cryptoHmacVerifyDefinition: ActionDefinition = {
  key: 'crypto.hmac-verify',
  ...baseDefinition('crypto.hmac-verify'),
  riskClass: 'MEDIUM',
  secretReferenceFields: ['input.key'],
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      algorithm: { type: 'string', enum: ALGORITHM_ENUM, default: 'sha256' },
      data: { type: 'string', description: 'The exact payload that was signed (e.g. Stripe `timestamp.payload`).' },
      key: { type: 'string', title: 'Secret key' },
      digest: { type: 'string', title: 'Expected digest' },
      encoding: { type: 'string', title: 'Digest encoding', enum: ENCODING_ENUM, default: 'hex' },
    },
    required: ['data', 'key', 'digest'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { valid: { type: 'boolean' }, algorithm: { type: 'string' } } }),
};
export const cryptoHmacVerifyExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { algorithm, data, key, digest, encoding } = (input ?? {}) as {
      algorithm?: unknown; data?: unknown; key?: unknown; digest?: unknown; encoding?: unknown;
    };
    const algo = resolveAlgorithm(algorithm);
    if (!algo) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Unsupported HMAC algorithm. Allowed: ${[...ALLOWED_ALGORITHMS].join(', ')}.` };
    }
    if (typeof data !== 'string' || typeof key !== 'string' || key.length === 0 || typeof digest !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.data, input.key, and input.digest (strings).' };
    }
    const actual = createHmac(algo, key).update(data, 'utf8').digest(resolveEncoding(encoding));
    const expected = digest;
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    const valid = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
    return { status: 'SUCCEEDED', output: { valid, algorithm: algo } };
  },
};
