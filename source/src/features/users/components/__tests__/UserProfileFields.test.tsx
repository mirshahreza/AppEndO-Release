/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  PERSON_TYPE_COMPANY,
  PERSON_TYPE_INDIVIDUAL,
} from '../../../../shared/profile/personType';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { UserProfileFields } from '../UserProfileFields';

const personTypeOptions = [
  { id: PERSON_TYPE_INDIVIDUAL, label: 'Individual' },
  { id: PERSON_TYPE_COMPANY, label: 'Company' },
];

const emptyValues = {
  firstName: '',
  lastName: '',
  fatherName: '',
  grandfatherName: '',
  nickname: '',
  nationalCode: '',
  genderCode: '',
  personTypeCode: '',
  companyName: '',
  registrationNumber: '',
  website: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
};

function renderFields(layoutPersonTypeCode: string) {
  return render(
    <CultureProvider cultureId="us">
      <UserProfileFields
        values={{ ...emptyValues, personTypeCode: layoutPersonTypeCode }}
        layoutPersonTypeCode={layoutPersonTypeCode}
        personTypeOptions={personTypeOptions}
        genderOptions={[]}
        onChange={() => {}}
      />
    </CultureProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('UserProfileFields', () => {
  it('shows personal sections for individual layout person type', () => {
    renderFields(PERSON_TYPE_INDIVIDUAL);
    expect(screen.getByText('Personal Information')).toBeTruthy();
    expect(screen.getByText('Birth Date')).toBeTruthy();
    expect(screen.queryByText('Company Information')).toBeNull();
  });

  it('shows company section for company layout person type', () => {
    renderFields(PERSON_TYPE_COMPANY);
    expect(screen.getByText('Company Information')).toBeTruthy();
    expect(screen.queryByText('Personal Information')).toBeNull();
    expect(screen.queryByText('Birth Date')).toBeNull();
  });
});
