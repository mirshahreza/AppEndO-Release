import { validateJsonSchema } from '../../../../utils/jsonSchemaValidate';
import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/**
 * Data Action pack (doc 04 section 4) — pure, deterministic, `sideEffectClass: 'PURE'`. No
 * Repository Reality Audit dependency: these operate only on the config/input JSON already
 * validated by the engine boundary.
 */

const inlineSchema = (schema: JsonValue = {}): { type: 'INLINE'; schema: JsonValue } => ({ type: 'INLINE', schema });

const baseDefinition = (key: string, tags: string[]): Omit<ActionDefinition, 'key'> => ({
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
  tags: ['data', ...tags],
}) as unknown as Omit<ActionDefinition, 'key'>;

export const dataJsonParseDefinition: ActionDefinition = {
  key: 'data.json-parse',
  ...baseDefinition('data.json-parse', ['json']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { text: { type: 'string', title: 'JSON text', description: 'The raw JSON string to parse.' } },
    required: ['text'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { value: { description: 'The parsed value.' } } }),
};
export const dataJsonParseExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    if (typeof input !== 'object' || input === null || !('text' in (input as Record<string, unknown>))) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.text (string).' };
    }
    const text = (input as { text: unknown }).text;
    if (typeof text !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.text must be a string.' };
    }
    try {
      const value = JSON.parse(text) as JsonValue;
      return { status: 'SUCCEEDED', output: { value } };
    } catch {
      return { status: 'FAILED', errorCode: 'WF_EXEC_EXPRESSION_FAILED', errorClass: 'PARSE_ERROR', safeMessage: 'Input text is not valid JSON.' };
    }
  },
};

export const dataJsonStringifyDefinition: ActionDefinition = {
  key: 'data.json-stringify',
  ...baseDefinition('data.json-stringify', ['json']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { value: { description: 'Any value to serialize to a JSON string.' } },
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string', title: 'JSON text' } } }),
};
export const dataJsonStringifyExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const value = (input as { value?: JsonValue })?.value ?? null;
    return { status: 'SUCCEEDED', output: { text: JSON.stringify(value) } };
  },
};

export const dataSetDefinition: ActionDefinition = {
  key: 'data.set',
  ...baseDefinition('data.set', ['transform']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { value: { description: "The value to pass through as this action's output." } },
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { value: { description: 'The same value passed through unchanged.' } } }),
};
export const dataSetExecutor: ActionExecutor = {
  /** Pass-through Action — the value to set is already computed by the node's canonical `input` mapping (doc 05 section 26); this Action exists so authors have an explicit "produce this value" step. */
  async execute(_context, _config, input) {
    return { status: 'SUCCEEDED', output: { value: (input as { value?: JsonValue })?.value ?? null } };
  },
};

/**
 * WFV2-8 — wraps the real, already-shared `validateJsonSchema` (Ajv-backed, `src/server/utils/jsonSchemaValidate.ts`,
 * added platform-wide when `ai.llm-structured` needed it). The prior Slice 3/5 "no ajv exists" gap
 * this Action was blocked on no longer holds — Repository Reality Audit re-check, not a new
 * primitive built here. A schema that is itself malformed (fails to compile) is a FAILED Action
 * (an authoring bug, not a data-validity question); a well-formed schema that the input value
 * fails is a SUCCEEDED result with `valid: false` so an author can branch on it with DECISION,
 * the same way `ai.llm-structured`'s own output-schema check treats compile failures differently
 * from mismatches.
 */
export const dataValidateDefinition: ActionDefinition = {
  key: 'data.validate',
  ...baseDefinition('data.validate', ['validation']),
  configSchema: inlineSchema({
    type: 'object',
    properties: { schema: { type: 'object', title: 'JSON Schema', description: 'A JSON Schema object to validate input.value against.' } },
    required: ['schema'],
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { value: { description: 'The value to validate against config.schema.' } },
    required: ['value'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      errors: { type: 'array', description: 'Validation error messages (empty when valid).' },
    },
  }),
};
export const dataValidateExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const schema = (config as { schema?: unknown })?.schema ?? (input as { schema?: unknown })?.schema;
    if (schema === undefined) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected config.schema or input.schema (a JSON Schema object).' };
    }
    const value = (input as { value?: unknown })?.value;
    const result = validateJsonSchema(schema, value);
    if (!result.valid && result.errors.some((e) => e.startsWith('SCHEMA_INVALID'))) {
      return { status: 'FAILED', errorCode: 'DATA_VALIDATE_SCHEMA_INVALID', errorClass: 'VALIDATION', safeMessage: result.errors.join('; ') };
    }
    return { status: 'SUCCEEDED', output: { valid: result.valid, errors: result.valid ? [] : result.errors } };
  },
};

const asArray = (value: unknown): JsonValue[] | null => (Array.isArray(value) ? (value as JsonValue[]) : null);

/**
 * `data.map` / `data.filter` (per-item CanonicalExpression) stay unregistered — that job is
 * FOR_EACH + CURRENT_ITEM. `data.map-records` below is the bulk field-rename Action for CSV
 * import (dest ← source keys, no expression language).
 */

const asObjectRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const asStringKeyMap = (value: unknown): Record<string, string> | null => {
  const record = asObjectRecord(value);
  if (!record) return null;
  const mapped: Record<string, string> = {};
  for (const [dest, source] of Object.entries(record)) {
    if (typeof source !== 'string' || source.trim().length === 0) return null;
    mapped[dest] = source;
  }
  return mapped;
};

const coerceMappedValue = (value: unknown, dest: string, numberFields: Set<string>): JsonValue => {
  if (!numberFields.has(dest)) return (value as JsonValue) ?? null;
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const dataMapRecordsDefinition: ActionDefinition = {
  key: 'data.map-records',
  ...baseDefinition('data.map-records', ['array', 'transform']),
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      fieldMap: {
        type: 'object',
        title: 'Field map',
        description: 'Destination field → source field (e.g. { "sku": "ProductCode", "title": "Name" }).',
      },
      defaults: {
        type: 'object',
        title: 'Defaults',
        description: 'Values applied when a destination field is missing after mapping.',
      },
      keepUnmapped: {
        type: 'boolean',
        title: 'Keep unmapped fields',
        default: false,
        description: 'When true, copy every source field then overlay fieldMap. When false, output only mapped + default fields.',
      },
      numberFields: {
        type: 'array',
        title: 'Number fields',
        description: 'Destination field names to coerce to numbers (empty string → null).',
      },
    },
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      records: { type: 'array', title: 'Records', description: 'Array of flat objects (e.g. data.csv-parse output.records).' },
    },
    required: ['records'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      records: { type: 'array' },
      count: { type: 'number' },
    },
  }),
};
export const dataMapRecordsExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const items = asArray((input as { records?: unknown })?.records);
    if (!items) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.records (array).' };
    }
    const fieldMap = asStringKeyMap((config as { fieldMap?: unknown })?.fieldMap) ?? {};
    const defaults = asObjectRecord((config as { defaults?: unknown })?.defaults) ?? {};
    const keepUnmapped = (config as { keepUnmapped?: unknown })?.keepUnmapped === true;
    const numberFieldsConfig = (config as { numberFields?: unknown })?.numberFields;
    const numberFields = new Set(
      Array.isArray(numberFieldsConfig)
        ? numberFieldsConfig.filter((name): name is string => typeof name === 'string')
        : [],
    );
    if (Object.keys(fieldMap).length === 0 && !keepUnmapped && Object.keys(defaults).length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID',
        errorClass: 'VALIDATION',
        safeMessage: 'Provide config.fieldMap, config.defaults, or set config.keepUnmapped to true.',
      };
    }

    const records: JsonValue[] = [];
    for (const item of items) {
      const source = asObjectRecord(item);
      if (!source) {
        return {
          status: 'FAILED',
          errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID',
          errorClass: 'VALIDATION',
          safeMessage: 'Every item in input.records must be a flat object.',
        };
      }
      const next: Record<string, JsonValue> = keepUnmapped
        ? Object.fromEntries(Object.entries(source).map(([k, v]) => [k, (v as JsonValue) ?? null]))
        : {};
      for (const [dest, sourceKey] of Object.entries(fieldMap)) {
        next[dest] = coerceMappedValue(source[sourceKey], dest, numberFields);
      }
      for (const [dest, value] of Object.entries(defaults)) {
        if (next[dest] === undefined || next[dest] === null || next[dest] === '') {
          next[dest] = coerceMappedValue(value, dest, numberFields);
        }
      }
      records.push(next);
    }
    return { status: 'SUCCEEDED', output: { records, count: records.length } };
  },
};

type AggregateOp = 'SUM' | 'COUNT' | 'MIN' | 'MAX' | 'AVG';

export const dataAggregateDefinition: ActionDefinition = {
  key: 'data.aggregate',
  ...baseDefinition('data.aggregate', ['array']),
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      op: { type: 'string', title: 'Operation', enum: ['SUM', 'COUNT', 'MIN', 'MAX', 'AVG'], default: 'COUNT', description: 'Aggregate function applied to input.items.' },
    },
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { items: { type: 'array', description: 'Array of items (must be numbers for every op except COUNT).' } },
    required: ['items'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { result: { type: 'number', description: 'The aggregate result.' } } }),
};
export const dataAggregateExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const items = asArray((input as { items?: unknown })?.items);
    if (!items) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.items (array).' };
    }
    const op = (config as { op?: AggregateOp })?.op ?? 'COUNT';
    if (op === 'COUNT') {
      return { status: 'SUCCEEDED', output: { result: items.length } };
    }
    const numbers = items.filter((i): i is number => typeof i === 'number');
    if (numbers.length !== items.length) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Aggregate op ${op} requires all items to be numbers.` };
    }
    if (numbers.length === 0) {
      return { status: 'SUCCEEDED', output: { result: op === 'SUM' || op === 'AVG' ? 0 : null } };
    }
    switch (op) {
      case 'SUM':
        return { status: 'SUCCEEDED', output: { result: numbers.reduce((a, b) => a + b, 0) } };
      case 'MIN':
        return { status: 'SUCCEEDED', output: { result: Math.min(...numbers) } };
      case 'MAX':
        return { status: 'SUCCEEDED', output: { result: Math.max(...numbers) } };
      case 'AVG':
        return { status: 'SUCCEEDED', output: { result: numbers.reduce((a, b) => a + b, 0) / numbers.length } };
      default:
        return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: `Unknown aggregate op ${String(op)}.` };
    }
  },
};

/**
 * WFV2-5 (partial) — CSV as a pure string<->array transform, no filesystem access at all. Closes
 * the CSV-processing half of p-61 F-7/S13 (turning a CSV *string* — already read into a workflow
 * via `integration.http-request`/Start `input` — into structured data) without needing a governed
 * file-storage Reality Audit, which the *reading a file from disk* half of F-7 still needs (see
 * p-62's WFV2-5 entry). Hand-rolled character-scanner (RFC4180-ish: quoted fields, doubled-quote
 * escaping, embedded delimiter/newline inside quotes, CRLF/LF) — no CSV dependency exists in this
 * repo and a naive `.split(',')` silently corrupts any quoted field containing the delimiter.
 */
function parseCsvText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvFieldNeedsQuoting(field: string, delimiter: string): boolean {
  return field.includes(delimiter) || field.includes('"') || field.includes('\n') || field.includes('\r');
}

function stringifyCsvField(field: string, delimiter: string): string {
  if (!csvFieldNeedsQuoting(field, delimiter)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

export const dataCsvParseDefinition: ActionDefinition = {
  key: 'data.csv-parse',
  ...baseDefinition('data.csv-parse', ['array', 'csv']),
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      delimiter: { type: 'string', title: 'Delimiter', default: ',', description: 'Single-character field delimiter.' },
      hasHeader: { type: 'boolean', title: 'Has header row', default: true },
    },
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { text: { type: 'string', title: 'CSV text' } },
    required: ['text'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      rows: { type: 'array', description: 'Every row (including the header row, if any) as a string array.' },
      records: { type: 'array', description: 'Rows keyed by header column name (null when config.hasHeader is false).' },
    },
  }),
};
export const dataCsvParseExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const text = (input as { text?: unknown })?.text;
    if (typeof text !== 'string') {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.text (string).' };
    }
    const delimiterConfig = (config as { delimiter?: unknown })?.delimiter;
    const delimiter = typeof delimiterConfig === 'string' && delimiterConfig.length === 1 ? delimiterConfig : ',';
    const hasHeaderConfig = (config as { hasHeader?: unknown })?.hasHeader;
    const hasHeader = hasHeaderConfig !== false;

    const rows = parseCsvText(text, delimiter);
    if (!hasHeader) {
      return { status: 'SUCCEEDED', output: { rows, records: null } };
    }
    if (rows.length === 0) {
      return { status: 'SUCCEEDED', output: { rows, records: [] } };
    }
    const [header, ...dataRows] = rows;
    const records = dataRows.map((row) => {
      const record: Record<string, string> = {};
      header.forEach((col, idx) => {
        record[col] = row[idx] ?? '';
      });
      return record;
    });
    return { status: 'SUCCEEDED', output: { rows, records } };
  },
};

export const dataCsvStringifyDefinition: ActionDefinition = {
  key: 'data.csv-stringify',
  ...baseDefinition('data.csv-stringify', ['array', 'csv']),
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      delimiter: { type: 'string', title: 'Delimiter', default: ',', description: 'Single-character field delimiter.' },
      columns: { type: 'array', title: 'Columns', description: 'Optional explicit column order (defaults to the keys found in input.records).' },
    },
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      records: { type: 'array', description: 'Array of flat objects, one per row (use this OR input.rows).' },
      rows: { type: 'array', description: 'Array of string arrays, first row is the header (use this OR input.records).' },
    },
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string', title: 'CSV text' } } }),
};
export const dataCsvStringifyExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const delimiterConfig = (config as { delimiter?: unknown })?.delimiter;
    const delimiter = typeof delimiterConfig === 'string' && delimiterConfig.length === 1 ? delimiterConfig : ',';
    const records = (input as { records?: unknown })?.records;
    const rowsInput = (input as { rows?: unknown })?.rows;

    let rows: string[][];
    if (Array.isArray(records)) {
      if (!records.every((r) => typeof r === 'object' && r !== null && !Array.isArray(r))) {
        return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.records must be an array of flat objects.' };
      }
      const columnsConfig = (config as { columns?: unknown })?.columns;
      const columns = Array.isArray(columnsConfig) && columnsConfig.every((c) => typeof c === 'string')
        ? (columnsConfig as string[])
        : Array.from(new Set(records.flatMap((r) => Object.keys(r as Record<string, unknown>))));
      const dataRows = (records as Record<string, unknown>[]).map((r) => columns.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));
      rows = [columns, ...dataRows];
    } else if (Array.isArray(rowsInput)) {
      if (!rowsInput.every((r) => Array.isArray(r) && r.every((cell) => typeof cell === 'string'))) {
        return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'input.rows must be an array of string arrays.' };
      }
      rows = rowsInput as string[][];
    } else {
      return { status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION', safeMessage: 'Expected input.records (object[]) or input.rows (string[][]).' };
    }

    const text = rows.map((row) => row.map((field) => stringifyCsvField(field, delimiter)).join(delimiter)).join('\r\n');
    return { status: 'SUCCEEDED', output: { text } };
  },
};
