import { safeRegexMatch } from '../../../../utils/safeRegex';
import { renderTemplate, TemplateSyntaxError } from './templateEngine';
import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/**
 * Text Action pack (doc 04 section 4). `text.regex-match` was UNAVAILABLE per doc 04 section 4
 * ("Bounded regex ... MUST reuse canonical AppEndO primitives. If absent, affected Actions are
 * unavailable; Workflow does not invent a parallel trust primitive.") until
 * `src/server/utils/safeRegex.ts` was added as that canonical platform-wide primitive (RE2/WASM,
 * linear-time — cannot catastrophically backtrack regardless of pattern). Now AVAILABLE, wired
 * against that primitive rather than `new RegExp(...)`.
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const baseDefinition = (available: boolean) => ({
  version: '1',
  contributor: { type: 'CORE' as const, id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema(),
  outputSchema: inlineSchema(),
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'DEDUPLICATED' as const, deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE' as const,
  sideEffectClass: 'PURE' as const,
  riskClass: 'LOW' as const,
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: (available ? 'AVAILABLE' : 'UNAVAILABLE') as ActionDefinition['availability'],
  executionMode: 'DETERMINISTIC' as const,
  tags: ['text'],
});

export const textTemplateDefinition: ActionDefinition = {
  key: 'text.template',
  ...baseDefinition(true),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      template: {
        type: 'string',
        description:
          'Template text. `{{path.to.value}}` (dot-paths and array indices), `{{#each items}}...{{.}}/{{@index}}...{{/each}}`, `{{#if path}}...{{else}}...{{/if}}`, `{{#unless path}}...{{/unless}}`. A field that resolves to nothing leaves the placeholder text unchanged.',
      },
      variables: { type: 'object', description: 'Values substituted into the template.' },
    },
    required: ['template', 'variables'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string' } } }),
};
export const textTemplateExecutor: ActionExecutor = {
  /** p-99/WFT-10 — `templateEngine.ts`'s logic-less mini-language (dot-paths, #each, #if/#unless) —
   * no arbitrary expression evaluation (doc 05 section 3: no arbitrary JS). */
  async execute(_context, _config, input) {
    const template = (input as { template?: unknown })?.template;
    const variables = (input as { variables?: unknown })?.variables;
    if (typeof template !== 'string' || typeof variables !== 'object' || variables === null) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.template (string) and input.variables (object).' };
    }
    try {
      const result = renderTemplate(template, variables as JsonValue);
      return { status: 'SUCCEEDED', output: { text: result } };
    } catch (error) {
      if (error instanceof TemplateSyntaxError) {
        return { status: 'FAILED', errorCode: 'TEXT_TEMPLATE_SYNTAX_INVALID', errorClass: 'VALIDATION', safeMessage: error.message };
      }
      throw error;
    }
  },
};

export const textReplaceDefinition: ActionDefinition = {
  key: 'text.replace',
  ...baseDefinition(true),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      text: { type: 'string' },
      search: { type: 'string', description: 'Literal substring to find (not a regex).' },
      replacement: { type: 'string' },
    },
    required: ['text', 'search', 'replacement'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string' } } }),
};
export const textReplaceExecutor: ActionExecutor = {
  /** Literal substring replacement only — never a regex, matching the regex-match Action's unavailability (no ReDoS surface). */
  async execute(_context, _config, input) {
    const { text, search, replacement } = (input ?? {}) as { text?: unknown; search?: unknown; replacement?: unknown };
    if (typeof text !== 'string' || typeof search !== 'string' || typeof replacement !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.text/search/replacement (strings).' };
    }
    return { status: 'SUCCEEDED', output: { text: text.split(search).join(replacement) } };
  },
};

export const textSplitDefinition: ActionDefinition = {
  key: 'text.split',
  ...baseDefinition(true),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { text: { type: 'string' }, separator: { type: 'string' } },
    required: ['text', 'separator'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { parts: { type: 'array', description: 'The split string pieces.' } } }),
};
export const textSplitExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { text, separator } = (input ?? {}) as { text?: unknown; separator?: unknown };
    if (typeof text !== 'string' || typeof separator !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.text/separator (strings).' };
    }
    return { status: 'SUCCEEDED', output: { parts: text.split(separator) } };
  },
};

export const textJoinDefinition: ActionDefinition = {
  key: 'text.join',
  ...baseDefinition(true),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      parts: { type: 'array', description: 'Array of strings to join.' },
      separator: { type: 'string' },
    },
    required: ['parts', 'separator'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string' } } }),
};
export const textJoinExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const { parts, separator } = (input ?? {}) as { parts?: unknown; separator?: unknown };
    if (!Array.isArray(parts) || !parts.every((p) => typeof p === 'string') || typeof separator !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.parts (string[]) and input.separator (string).' };
    }
    return { status: 'SUCCEEDED', output: { text: (parts as string[]).join(separator) } };
  },
};

export const textRegexMatchDefinition: ActionDefinition = {
  key: 'text.regex-match',
  ...baseDefinition(true),
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression pattern (RE2 syntax, ReDoS-safe).' },
      flags: { type: 'string', description: 'Optional regex flags, e.g. "i" for case-insensitive.' },
      global: { type: 'boolean', title: 'Match all occurrences', default: false },
    },
    required: ['pattern'],
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      matched: { type: 'boolean' },
      matches: { type: 'array', description: 'One entry per match: { match, index, groups, namedGroups }.' },
    },
  }),
};
export const textRegexMatchExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const text = (input as { text?: unknown })?.text;
    const pattern = (config as { pattern?: unknown })?.pattern ?? (input as { pattern?: unknown })?.pattern;
    const flags = (config as { flags?: unknown })?.flags ?? (input as { flags?: unknown })?.flags;
    const global = (config as { global?: unknown })?.global ?? (input as { global?: unknown })?.global;
    if (typeof text !== 'string' || typeof pattern !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.text (string) and config.pattern/input.pattern (string).' };
    }
    if (flags !== undefined && typeof flags !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'flags must be a string when provided.' };
    }
    const result = safeRegexMatch(pattern, text, { flags: flags as string | undefined, global: global === true });
    if (!result.ok) {
      return { status: 'FAILED', errorCode: `TEXT_REGEX_${result.errorCode}`, errorClass: 'VALIDATION', safeMessage: result.message };
    }
    return {
      status: 'SUCCEEDED',
      output: {
        matched: result.matched,
        matches: result.matches.map((m) => ({ match: m.match, index: m.index, groups: m.groups, namedGroups: m.namedGroups })),
      },
    };
  },
};
