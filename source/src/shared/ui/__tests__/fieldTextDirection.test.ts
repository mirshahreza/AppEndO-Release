import { describe, expect, it } from 'vitest';

import {
  isAutoDirSkippedInputType,
  resolveAutoDirEnabled,
  resolveFieldMenuDirection,
  resolveFieldTextDirection,
} from '../fieldTextDirection';

describe('fieldTextDirection', () => {
  it('enables autoDir by default for text-like types', () => {
    expect(resolveAutoDirEnabled(undefined)).toBe(true);
    expect(resolveAutoDirEnabled(undefined, 'text')).toBe(true);
    expect(resolveAutoDirEnabled(undefined, 'search')).toBe(true);
  });

  it('skips autoDir for machine-oriented types even when defaulted', () => {
    expect(isAutoDirSkippedInputType('password')).toBe(true);
    expect(resolveAutoDirEnabled(undefined, 'password')).toBe(false);
    expect(resolveAutoDirEnabled(true, 'number')).toBe(false);
    expect(resolveAutoDirEnabled(true, 'email')).toBe(false);
  });

  it('respects explicit autoDir=false', () => {
    expect(resolveAutoDirEnabled(false, 'text')).toBe(false);
  });

  it('resolves rtl/ltr from first meaningful character when autoDir is on', () => {
    expect(resolveFieldTextDirection(undefined, true, 'سلام')).toBe('rtl');
    expect(resolveFieldTextDirection(undefined, true, 'Hello')).toBe('ltr');
    expect(resolveFieldTextDirection('auto', true, 'مرحبا')).toBe('rtl');
  });

  it('inherits document direction for empty value instead of forcing ltr', () => {
    expect(resolveFieldTextDirection(undefined, true, '')).toBeUndefined();
    expect(resolveFieldTextDirection(undefined, true, '', 'Search…')).toBeUndefined();
  });

  it('uses rtl placeholder when value is empty', () => {
    expect(resolveFieldTextDirection(undefined, true, '', 'البحث في الأعضاء…')).toBe('rtl');
  });

  it('lets explicit dir win over autoDir', () => {
    expect(resolveFieldTextDirection('ltr', true, 'سلام')).toBe('ltr');
    expect(resolveFieldTextDirection('rtl', true, 'Hello')).toBe('rtl');
  });

  it('returns undefined when autoDir is off and dir is unset', () => {
    expect(resolveFieldTextDirection(undefined, false, 'سلام')).toBeUndefined();
  });

  it('resolves menu direction from field dir or culture', () => {
    expect(resolveFieldMenuDirection('rtl', 'ltr')).toBe('rtl');
    expect(resolveFieldMenuDirection(undefined, 'rtl')).toBe('rtl');
    expect(resolveFieldMenuDirection(undefined, 'ltr')).toBe('ltr');
  });
});
