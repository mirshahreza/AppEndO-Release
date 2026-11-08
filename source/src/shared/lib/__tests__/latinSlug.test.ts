import { describe, expect, it } from 'vitest';
import {
  LATIN_SLUG_RE,
  allocateInternalLatinSlug,
  sanitizeLatinSlugInput,
  validateLatinSlug,
} from '../latinSlug';

describe('latinSlug', () => {
  it('matches valid slug characters', () => {
    expect(LATIN_SLUG_RE.test('my-portal')).toBe(true);
    expect(LATIN_SLUG_RE.test('my_app.v2')).toBe(true);
    expect(LATIN_SLUG_RE.test('My-Portal')).toBe(false);
    expect(LATIN_SLUG_RE.test('bad/slug')).toBe(false);
  });

  it('sanitizes slug input by stripping slashes and invalid characters', () => {
    expect(sanitizeLatinSlugInput('/portal')).toBe('portal');
    expect(sanitizeLatinSlugInput('My-Portal')).toBe('my-portal');
    expect(sanitizeLatinSlugInput('a/b/c')).toBe('abc');
    expect(sanitizeLatinSlugInput('bad slug!')).toBe('badslug');
  });

  it('validates latin slug values', () => {
    expect(validateLatinSlug('my-portal')).toBeNull();
    expect(validateLatinSlug('')).toBe('Name is required.');
    expect(validateLatinSlug('My-Portal')).toContain('lowercase');
    expect(validateLatinSlug('bad/slug', { fieldLabel: 'URL segment' })).toContain('URL segment');
  });

  it('allocates an internal slug from a title and uniquifies collisions', () => {
    expect(allocateInternalLatinSlug({
      seed: 'Edge Files',
      id: '11111111-2222-3333-4444-555555555555',
      taken: [],
    })).toBe('edge-files');
    expect(allocateInternalLatinSlug({
      seed: 'Edge Files',
      id: '11111111-2222-3333-4444-555555555555',
      taken: ['edge-files'],
    })).toBe('edge-files-2');
    expect(allocateInternalLatinSlug({
      seed: 'سرور تولید',
      id: '11111111-2222-3333-4444-555555555555',
      taken: [],
    })).toBe('c-111111112222');
  });
});
