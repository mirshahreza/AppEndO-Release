import { describe, expect, it } from 'vitest';
import {
  hasRenderableObjectSchema,
  humanizeWorkItemFieldKey,
  inferJsonSchemaFromValue,
  normalizeWorkItemPayloadRoot,
  resolveRawOutputSchema,
  workItemPayloadHasDisplayableFields,
} from '../workItemSchemaUtils';

describe('workItemSchemaUtils', () => {
  it('unwraps INLINE outputSchemaJson', () => {
    const raw = JSON.stringify({
      type: 'INLINE',
      schema: { type: 'object', properties: { approved: { type: 'boolean' } } },
    });
    expect(resolveRawOutputSchema(raw)).toEqual({
      type: 'object',
      properties: { approved: { type: 'boolean' } },
    });
  });

  it('humanizes camelCase and snake keys', () => {
    expect(humanizeWorkItemFieldKey('requestAmount')).toBe('Request Amount');
    expect(humanizeWorkItemFieldKey('due_date')).toBe('Due Date');
  });

  it('infers nested object schema with titles', () => {
    const schema = inferJsonSchemaFromValue({ requestAmount: 1200, approved: true });
    expect(schema.type).toBe('object');
    expect((schema.properties as Record<string, { title?: string }>).requestAmount?.title).toBe('Request Amount');
  });

  it('wraps primitive roots for read-only forms', () => {
    const { formData, schema } = normalizeWorkItemPayloadRoot('plain');
    expect(formData).toEqual({ value: 'plain' });
    expect(schema.properties).toHaveProperty('value');
  });

  it('detects renderable object schemas', () => {
    expect(hasRenderableObjectSchema({ type: 'object', properties: { a: { type: 'string' } } })).toBe(true);
    expect(hasRenderableObjectSchema({ type: 'object', properties: {} })).toBe(false);
    expect(hasRenderableObjectSchema(null)).toBe(false);
  });

  it('skips empty object payloads for task context display', () => {
    expect(workItemPayloadHasDisplayableFields('{}')).toBe(false);
    expect(workItemPayloadHasDisplayableFields(JSON.stringify({ amount: 1 }))).toBe(true);
  });
});
