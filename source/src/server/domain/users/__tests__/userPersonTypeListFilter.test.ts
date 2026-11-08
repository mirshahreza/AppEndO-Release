import { describe, expect, it } from 'vitest';
import { buildUserPersonTypeCodeFilter } from '../userPersonTypeListFilter';

describe('buildUserPersonTypeCodeFilter', () => {
  it('returns null for empty code', () => {
    expect(buildUserPersonTypeCodeFilter('')).toBeNull();
    expect(buildUserPersonTypeCodeFilter('   ')).toBeNull();
  });

  it('builds single person type filter', () => {
    expect(buildUserPersonTypeCodeFilter('100.2.1')).toEqual({
      profile: { personTypeCode: '100.2.1' },
    });
  });
});
