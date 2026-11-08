import { describe, expect, it } from 'vitest';
import {
  sanitizeEdgeColumnNameInput,
  validateEdgeColumnName,
} from '../edgeModelColumnUtils';

describe('sanitizeEdgeColumnNameInput', () => {
  it('keeps lowercase letters and underscores', () => {
    expect(sanitizeEdgeColumnNameInput('Customer_Name')).toBe('customer_name');
  });

  it('strips digits, spaces, and non-latin characters', () => {
    expect(sanitizeEdgeColumnNameInput('user2 nameنام!')).toBe('username');
  });

  it('rejects leading underscore', () => {
    expect(sanitizeEdgeColumnNameInput('_id')).toBe('id');
  });
});

describe('validateEdgeColumnName', () => {
  it('accepts letter-started snake names', () => {
    expect(validateEdgeColumnName('customer_name')).toBeNull();
  });

  it('rejects empty, digits, and leading underscore', () => {
    expect(validateEdgeColumnName('')).toMatch(/required/i);
    expect(validateEdgeColumnName('col2')).toMatch(/English letters/i);
    expect(validateEdgeColumnName('_id')).toMatch(/start with a letter/i);
  });
});
