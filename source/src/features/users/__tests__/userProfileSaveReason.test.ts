import { describe, expect, it } from 'vitest';
import { EMPTY_EDIT_FORM } from '../constants';
import type { UserRecord } from '../../../shared/api/queries/users';
import {
  listChangedUserProfileFormFields,
  resolveUserProfileChangeReasonGate,
  roleSetsEqual,
} from '../userProfileSaveReason';

const user = (patch: Partial<UserRecord>): UserRecord => ({
  id: 1,
  username: 'ada',
  email: 'ada@example.com',
  role: 'ADMIN',
  roles: ['ADMIN'],
  firstname: 'Ada',
  lastname: 'Lovelace',
  fathername: 'Byron',
  grandfathername: '',
  nickname: '',
  national_code: '1234567890',
  birth_year: '1400',
  birth_month: '01',
  birth_day: '01',
  gender_code: '100.1.1',
  person_type_code: '100.2.1',
  company_name: '',
  registration_number: '',
  website: '',
  locked: false,
  is_builtin: false,
  created_at: '2026-01-01',
  ...patch,
});

const formFrom = (record: UserRecord) => ({
  ...EMPTY_EDIT_FORM,
  firstName: record.firstname ?? '',
  lastName: record.lastname ?? '',
  fatherName: record.fathername ?? '',
  grandfatherName: record.grandfathername ?? '',
  nickname: record.nickname ?? '',
  nationalCode: record.national_code ?? '',
  birthYear: record.birth_year ?? '',
  birthMonth: record.birth_month ?? '',
  birthDay: record.birth_day ?? '',
  genderCode: record.gender_code ?? '',
  personTypeCode: record.person_type_code ?? '',
  companyName: record.company_name ?? '',
  registrationNumber: record.registration_number ?? '',
  website: record.website ?? '',
});

describe('user profile save reason gate', () => {
  it('skips the dialog when nothing on the profile API changed', () => {
    const record = user({});
    expect(resolveUserProfileChangeReasonGate(record, formFrom(record))).toBe('skip');
  });

  it('opens an optional dialog for image-only edits of the profile API', () => {
    const record = user({});
    const form = {
      ...formFrom(record),
      profileImageBody: 'abc',
      profileImageBodyXs: 'xs',
      profileImageMime: 'image/jpeg',
    };
    expect(listChangedUserProfileFormFields(record, form)).toEqual([]);
    expect(resolveUserProfileChangeReasonGate(record, form)).toBe('optional');
  });

  it('opens an optional dialog when any profile field changes', () => {
    const record = user({});
    expect(resolveUserProfileChangeReasonGate(record, { ...formFrom(record), fatherName: 'George' })).toBe('optional');
    expect(resolveUserProfileChangeReasonGate(record, { ...formFrom(record), firstName: 'Augusta' })).toBe('optional');
    expect(resolveUserProfileChangeReasonGate(record, { ...formFrom(record), nationalCode: '0987654321' })).toBe('optional');
  });

  it('treats role set order as equal', () => {
    expect(roleSetsEqual(['admin', 'DEVELOPER'], ['DEVELOPER', 'ADMIN'])).toBe(true);
    expect(roleSetsEqual(['ADMIN'], ['ADMIN', 'DEVELOPER'])).toBe(false);
  });
});
