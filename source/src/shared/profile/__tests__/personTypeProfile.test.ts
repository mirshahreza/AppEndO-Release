import { describe, expect, it } from 'vitest';
import { formatProfileDisplayName } from '../../../shared/profile/profileDisplayName';
import {
  isCompanyPersonType,
  isIndividualPersonType,
  isProfileFieldVisibleForPersonType,
  PERSON_TYPE_COMPANY,
  PERSON_TYPE_INDIVIDUAL,
} from '../../../shared/profile/personType';

describe('personType profile helpers', () => {
  it('classifies individual and company codes', () => {
    expect(isIndividualPersonType(PERSON_TYPE_INDIVIDUAL)).toBe(true);
    expect(isCompanyPersonType(PERSON_TYPE_COMPANY)).toBe(true);
    expect(isIndividualPersonType(PERSON_TYPE_COMPANY)).toBe(false);
  });

  it('hides individual-only fields for company profiles', () => {
    expect(isProfileFieldVisibleForPersonType('firstname', PERSON_TYPE_COMPANY)).toBe(false);
    expect(isProfileFieldVisibleForPersonType('company_name', PERSON_TYPE_COMPANY)).toBe(true);
    expect(isProfileFieldVisibleForPersonType('company_name', PERSON_TYPE_INDIVIDUAL)).toBe(false);
  });

  it('formats company display name from company_name', () => {
    expect(formatProfileDisplayName({
      person_type_code: PERSON_TYPE_COMPANY,
      company_name: 'Pars Technology',
    })).toBe('Pars Technology');
  });

  it('formats individual display name from first and last name', () => {
    expect(formatProfileDisplayName({
      person_type_code: PERSON_TYPE_INDIVIDUAL,
      firstname: 'Sara',
      lastname: 'Ahmadi',
    })).toBe('Sara Ahmadi');
  });
});
