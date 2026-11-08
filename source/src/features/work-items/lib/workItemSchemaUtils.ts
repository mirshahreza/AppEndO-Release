import type { RJSFSchema } from '@rjsf/utils';

/** Unwrap `outputSchemaJson` (`JsonSchemaRefOrInline` INLINE wrapper) to a plain JSON Schema object. */
export const resolveRawOutputSchema = (outputSchemaJson: string | null): Record<string, unknown> | null => {
  if (!outputSchemaJson) return null;
  try {
    const parsed = JSON.parse(outputSchemaJson) as { type?: string; schema?: unknown };
    if (parsed?.type === 'INLINE' && parsed.schema && typeof parsed.schema === 'object') {
      return parsed.schema as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

export const humanizeWorkItemFieldKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

/** Best-effort schema for read-only RJSF display when no author-time input schema exists. */
export const inferJsonSchemaFromValue = (value: unknown): RJSFSchema => {
  if (value === null || value === undefined) {
    return { type: 'object', properties: {} };
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      title: 'Items',
      items: value.length > 0 ? inferJsonSchemaFromValue(value[0]) : {},
    };
  }
  if (typeof value === 'object') {
    const properties: Record<string, RJSFSchema> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const { title: _leafTitle, ...child } = inferJsonSchemaFromValue(entry);
      properties[key] = {
        ...child,
        title: humanizeWorkItemFieldKey(key),
      };
    }
    return { type: 'object', properties };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }
  if (typeof value === 'number') {
    return { type: 'number' };
  }
  return { type: 'string' };
};

/** Normalize parsed JSON into an object root for RJSF (primitives wrap under `value`). */
export const normalizeWorkItemPayloadRoot = (
  value: unknown,
): { formData: Record<string, unknown>; schema: RJSFSchema } => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return {
      formData: value as Record<string, unknown>,
      schema: inferJsonSchemaFromValue(value),
    };
  }
  return {
    formData: { value },
    schema: {
      type: 'object',
      properties: {
        value: {
          ...inferJsonSchemaFromValue(value),
          title: 'Value',
        },
      },
    },
  };
};

export const hasRenderableObjectSchema = (schema: Record<string, unknown> | null): boolean => {
  if (!schema || schema.type !== 'object') {
    return false;
  }
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') {
    return false;
  }
  return Object.keys(properties as Record<string, unknown>).length > 0;
};

export const parseWorkItemJsonPayload = (raw: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
};

/** True when payload JSON has at least one field worth showing in a read-only form. */
export const workItemPayloadHasDisplayableFields = (raw: string | null | undefined): boolean => {
  if (!raw?.trim()) {
    return false;
  }
  const parsed = parseWorkItemJsonPayload(raw.trim());
  if (!parsed.ok) {
    return true;
  }
  const { schema } = normalizeWorkItemPayloadRoot(parsed.value);
  if (schema.type !== 'object' || !schema.properties) {
    return false;
  }
  return Object.keys(schema.properties).length > 0;
};
