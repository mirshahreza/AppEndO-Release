import { describe, expect, it } from 'vitest';
import {
  assertSchemaObjectName,
  getSchemaObjectNameFieldState,
  sanitizeSchemaObjectNameInput,
  validateSchemaObjectName,
} from '../schemaObjectName';

describe('validateSchemaObjectName', () => {
  it('accepts lowercase snake_case names', () => {
    expect(validateSchemaObjectName('customer_orders')).toBeNull();
    expect(validateSchemaObjectName('widgets')).toBeNull();
  });

  it('rejects empty, uppercase, invalid characters, and base_ prefix', () => {
    expect(validateSchemaObjectName('')).toMatch(/required/i);
    expect(validateSchemaObjectName('CustomerOrders')).toMatch(/lowercase/i);
    expect(validateSchemaObjectName('bad-name')).toMatch(/lowercase letters, numbers, and underscores/i);
    expect(validateSchemaObjectName('base_users')).toMatch(/base_/i);
  });

  it('tracks install-style field state while typing', () => {
    expect(getSchemaObjectNameFieldState('')).toEqual({ invalid: true, message: null });
    expect(getSchemaObjectNameFieldState('customer_orders')).toEqual({ invalid: false, message: null });
    expect(getSchemaObjectNameFieldState('Bad')).toEqual({
      invalid: true,
      message: 'Object name must use lowercase letters only.',
    });
  });
});

describe('sanitizeSchemaObjectNameInput', () => {
  it('keeps lowercase snake_case characters and drops invalid input', () => {
    expect(sanitizeSchemaObjectNameInput('customer_orders')).toBe('customer_orders');
    expect(sanitizeSchemaObjectNameInput('Customer-Orders!')).toBe('customerorders');
    expect(sanitizeSchemaObjectNameInput('123abc')).toBe('abc');
    expect(sanitizeSchemaObjectNameInput('_abc')).toBe('abc');
  });

  it('enforces max length', () => {
    const longName = `a${'b'.repeat(200)}`;
    expect(sanitizeSchemaObjectNameInput(longName)).toHaveLength(128);
  });
});

describe('assertSchemaObjectName', () => {
  it('returns trimmed valid names', () => {
    expect(assertSchemaObjectName(' customer_orders ')).toBe('customer_orders');
  });

  it('throws with validation messages', () => {
    expect(() => assertSchemaObjectName('bad-name')).toThrow(/underscores/i);
  });
});
