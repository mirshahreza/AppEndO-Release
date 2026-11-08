import { describe, expect, it } from 'vitest';
import { resolveLegacyMemberFamilyCode } from '../hwyLegacyMemberFamilyCode';

describe('resolveLegacyMemberFamilyCode', () => {
  it('uses legacy FamilyCode, not province composite', () => {
    expect(resolveLegacyMemberFamilyCode('162421', '99999')).toBe('162421');
  });

  it('falls back to nakhebin roll family when member FamilyCode is empty', () => {
    expect(resolveLegacyMemberFamilyCode(null, '79058')).toBe('79058');
  });

  it('returns null when both are empty', () => {
    expect(resolveLegacyMemberFamilyCode('', null)).toBeNull();
  });
});
