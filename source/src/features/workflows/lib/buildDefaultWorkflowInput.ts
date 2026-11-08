import type { ActionJsonSchemaProperty, JsonValue, WorkflowModel } from '../types';
import { resolveInlineActionSchema } from '../types';

type PathSegment = string | number;

function placeholderForKey(key: string, prop?: ActionJsonSchemaProperty): JsonValue {
  if (prop?.default !== undefined) return prop.default;
  if (prop?.enum && prop.enum.length > 0) return prop.enum[0];

  const lower = key.toLowerCase();
  if (prop?.type === 'boolean' || /^(is|has|can|should|enabled|active|flag)/.test(lower)) return false;
  if (prop?.type === 'number' || prop?.type === 'integer' || /amount|count|total|max|min|index|qty|quantity|days|ms|size|limit/.test(lower)) return 0;
  if (prop?.type === 'array' || /list|items|records|users|sources|batch/.test(lower)) return [];
  if (prop?.type === 'object') return {};
  if (prop?.format === 'date' || prop?.format === 'date-time' || /date|iso|at$/.test(lower)) return '2026-01-01';
  if (/id$|key$|code$|ref$/.test(lower)) return `${key}-sample`;
  if (prop?.type === 'string' || /name|title|text|reason|notes|email|template/.test(lower)) return '';
  return '';
}

function setAtPath(target: Record<string, JsonValue>, segments: PathSegment[], value: JsonValue): void {
  let current: JsonValue = target;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (typeof segment === 'number') {
      if (!Array.isArray(current)) return;
      if (isLast) {
        current[segment] = value;
        return;
      }
      if (current[segment] === undefined) {
        const nextSegment = segments[index + 1];
        current[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      current = current[segment];
      continue;
    }

    if (typeof current !== 'object' || current === null || Array.isArray(current)) return;
    const record = current as Record<string, JsonValue>;

    if (isLast) {
      if (record[segment] === undefined) {
        record[segment] = value;
      }
      return;
    }

    if (record[segment] === undefined) {
      const nextSegment = segments[index + 1];
      record[segment] = typeof nextSegment === 'number' ? [] : {};
    }
    current = record[segment];
  }
}

function collectWorkflowInputPaths(value: unknown, paths: PathSegment[][]): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) collectWorkflowInputPaths(item, paths);
    return;
  }

  const record = value as Record<string, unknown>;
  if (record.op === 'PATH' && record.path && typeof record.path === 'object') {
    const path = record.path as { root?: { type?: string }; segments?: PathSegment[] };
    if (path.root?.type === 'WORKFLOW_INPUT') {
      paths.push(path.segments ?? []);
    }
  }

  for (const nested of Object.values(record)) {
    collectWorkflowInputPaths(nested, paths);
  }
}

function buildFromInputSchema(inputSchema: JsonValue): Record<string, JsonValue> | null {
  if (!inputSchema || typeof inputSchema !== 'object') return null;
  const ref = inputSchema as { type?: string; schema?: JsonValue };
  if (ref.type !== 'INLINE') return null;

  const schema = resolveInlineActionSchema(ref as { type: 'INLINE'; schema?: JsonValue });
  if (!schema?.properties) return null;

  const result: Record<string, JsonValue> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'object') {
      result[key] = {};
      continue;
    }
    if (prop.type === 'array') {
      result[key] = [];
      continue;
    }
    result[key] = placeholderForKey(key, prop);
  }
  return result;
}

/** Builds a runnable default workflow-input JSON string from the model schema and referenced paths. */
export function buildDefaultWorkflowInputJson(model: WorkflowModel): string {
  const fromSchema = buildFromInputSchema(model.inputSchema);
  const paths: PathSegment[][] = [];
  collectWorkflowInputPaths(model, paths);

  const result: Record<string, JsonValue> = fromSchema ? { ...fromSchema } : {};

  const schema = model.inputSchema && typeof model.inputSchema === 'object' && (model.inputSchema as { type?: string }).type === 'INLINE'
    ? resolveInlineActionSchema(model.inputSchema as { type: 'INLINE'; schema?: JsonValue })
    : null;

  for (const segments of paths) {
    if (segments.length === 0) continue;
    const head = segments[0];
    const key = typeof head === 'string' ? head : String(head);
    const prop = typeof head === 'string' ? schema?.properties?.[head] : undefined;
    setAtPath(result, segments, placeholderForKey(key, prop));
  }

  if (Object.keys(result).length === 0) {
    return '{}';
  }

  return JSON.stringify(result, null, 2);
}
