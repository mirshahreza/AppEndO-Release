import { describe, expect, it } from 'vitest';
import { resolveHwyMemberDirectoryFamilyCode } from '../hwyMemberDirectoryFamilyCode';

describe('resolveHwyMemberDirectoryFamilyCode', () => {
  it('prefers nakhebin family code over legacy member composite', () => {
    expect(resolveHwyMemberDirectoryFamilyCode({
      family_code: '10105.193586',
      nakhebin_family_code: '79058',
    })).toBe('79058');
  });

  it('uses member family code when it is not a province composite', () => {
    expect(resolveHwyMemberDirectoryFamilyCode({
      family_code: '34012',
    })).toBe('34012');
  });

  it('returns empty when only legacy province composite is present', () => {
    expect(resolveHwyMemberDirectoryFamilyCode({
      family_code: '10105.193586',
    })).toBe('');
  });
});
