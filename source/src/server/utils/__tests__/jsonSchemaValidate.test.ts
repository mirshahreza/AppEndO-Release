import { describe, expect, it } from 'vitest';
import { validateAgainstJsonSchema } from '../jsonSchemaValidate';

describe('validateAgainstJsonSchema', () => {
  it('treats an empty inline schema as imposing no constraints (matches existing corePack placeholder schemas)', () => {
    expect(validateAgainstJsonSchema({ type: 'INLINE', schema: {} }, { anything: 'goes' })).toEqual({ valid: true });
    expect(validateAgainstJsonSchema({ type: 'INLINE', schema: {} }, 42)).toEqual({ valid: true });
  });

  it('validates a value against a real inline schema', () => {
    const schema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] };
    expect(validateAgainstJsonSchema({ type: 'INLINE', schema }, { a: 1 })).toEqual({ valid: true });
    const result = validateAgainstJsonSchema({ type: 'INLINE', schema }, { a: 'not a number' });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('unreachable');
    expect(result.errors[0]).toContain('/a');
  });

  it('reports SCHEMA_REF_UNRESOLVED for REF schemas (no schema registry exists in this repo)', () => {
    const result = validateAgainstJsonSchema({ type: 'REF', ref: 'some://schema' }, {});
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('unreachable');
    expect(result.errors[0]).toContain('SCHEMA_REF_UNRESOLVED');
  });

  it('reports SCHEMA_INVALID instead of throwing on an uncompilable schema', () => {
    const result = validateAgainstJsonSchema({ type: 'INLINE', schema: { type: 'not-a-real-type' } }, {});
    expect(result.valid).toBe(false);
  });
});
