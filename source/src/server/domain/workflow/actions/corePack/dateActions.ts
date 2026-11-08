import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/** Date/time Action pack (doc 04 section 4) — pure, deterministic in the sense of "given the same wall-clock instant produces the same result"; `date.now` reads the real clock and is intentionally the only non-referentially-transparent Action here. */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const baseDefinition = () => ({
  version: '1',
  contributor: { type: 'CORE' as const, id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema(),
  outputSchema: inlineSchema(),
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'NONE' as const },
  cancellationSupport: 'NONE' as const,
  sideEffectClass: 'PURE' as const,
  riskClass: 'LOW' as const,
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE' as const,
  executionMode: 'DETERMINISTIC' as const,
  tags: ['date'],
});

export const dateNowDefinition: ActionDefinition = {
  key: 'date.now',
  ...baseDefinition(),
  outputSchema: inlineSchema({ type: 'object', properties: { iso: { type: 'string', title: 'ISO instant' } } }),
};
export const dateNowExecutor: ActionExecutor = {
  async execute() {
    return { status: 'SUCCEEDED', output: { iso: new Date().toISOString() } };
  },
};

export const dateAddDefinition: ActionDefinition = {
  key: 'date.add',
  ...baseDefinition(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      iso: { type: 'string', title: 'ISO instant', description: 'The instant to add to.' },
      amountMs: { type: 'number', title: 'Amount (ms)', description: 'Milliseconds to add (negative to subtract).' },
    },
    required: ['iso', 'amountMs'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { iso: { type: 'string', title: 'ISO instant' } } }),
};
export const dateAddExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { iso, amountMs } = (input ?? {}) as { iso?: unknown; amountMs?: unknown };
    if (typeof iso !== 'string' || typeof amountMs !== 'number' || !Number.isFinite(amountMs)) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.iso (string) and input.amountMs (finite number).' };
    }
    const base = Date.parse(iso);
    if (Number.isNaN(base)) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.iso is not a valid ISO instant.' };
    }
    return { status: 'SUCCEEDED', output: { iso: new Date(base + amountMs).toISOString() } };
  },
};

export const dateDiffDefinition: ActionDefinition = {
  key: 'date.diff',
  ...baseDefinition(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { fromIso: { type: 'string', title: 'From (ISO instant)' }, toIso: { type: 'string', title: 'To (ISO instant)' } },
    required: ['fromIso', 'toIso'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { diffMs: { type: 'number', title: 'Difference (ms)' } } }),
};
export const dateDiffExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { fromIso, toIso } = (input ?? {}) as { fromIso?: unknown; toIso?: unknown };
    if (typeof fromIso !== 'string' || typeof toIso !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.fromIso/toIso (strings).' };
    }
    const from = Date.parse(fromIso);
    const to = Date.parse(toIso);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'fromIso/toIso are not valid ISO instants.' };
    }
    return { status: 'SUCCEEDED', output: { diffMs: to - from } };
  },
};

export const dateFormatDefinition: ActionDefinition = {
  key: 'date.format',
  ...baseDefinition(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      iso: { type: 'string', title: 'ISO instant' },
      format: { type: 'string', enum: ['DATE_ONLY', 'ISO'], default: 'ISO' },
    },
    required: ['iso', 'format'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string' } } }),
};
export const dateFormatExecutor: ActionExecutor = {
  /** V1 formats support the safe, non-locale-ambiguous subset only — full strftime-style formatting is out of scope. */
  async execute(_context, _config, input) {
    const { iso, format } = (input ?? {}) as { iso?: unknown; format?: unknown };
    if (typeof iso !== 'string' || (format !== 'DATE_ONLY' && format !== 'ISO')) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.iso (string) and input.format ("DATE_ONLY" | "ISO").' };
    }
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.iso is not a valid ISO instant.' };
    }
    const date = new Date(parsed);
    const text = format === 'DATE_ONLY' ? date.toISOString().slice(0, 10) : date.toISOString();
    return { status: 'SUCCEEDED', output: { text } };
  },
};

export const dateTimezoneConvertDefinition: ActionDefinition = {
  key: 'date.timezone-convert',
  ...baseDefinition(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      iso: { type: 'string', title: 'ISO instant' },
      timeZone: { type: 'string', title: 'Time zone', description: 'IANA time zone name, e.g. "Asia/Tehran".' },
    },
    required: ['iso', 'timeZone'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: { formatted: { type: 'string' }, timeZone: { type: 'string' } },
  }),
};
export const dateTimezoneConvertExecutor: ActionExecutor = {
  /** Uses `Intl.DateTimeFormat` (Node's built-in ICU data) — no external timezone-database primitive to audit. */
  async execute(_context, _config, input) {
    const { iso, timeZone } = (input ?? {}) as { iso?: unknown; timeZone?: unknown };
    if (typeof iso !== 'string' || typeof timeZone !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.iso and input.timeZone (strings).' };
    }
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.iso is not a valid ISO instant.' };
    }
    try {
      const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(new Date(parsed));
      return { status: 'SUCCEEDED', output: { formatted, timeZone } };
    } catch {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Unknown IANA timeZone "${timeZone}".` };
    }
  },
};
