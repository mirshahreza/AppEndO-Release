import { describe, expect, it } from 'vitest';
import {
  resolveRecordEventFieldQuery,
  USER_PROFILE_HISTORY_FIELD_MAP,
} from '../recordEventHistoryFields';

describe('resolveRecordEventFieldQuery', () => {
  it('maps Users form fields to stored event fields', () => {
    expect(resolveRecordEventFieldQuery({
      subjectKind: 'base_users',
      field: 'firstName',
    })).toBe('profile.firstname');
    expect(resolveRecordEventFieldQuery({
      subjectKind: 'base_users',
      field: 'nationalCode',
    })).toBe('profile.national_code');
    expect(resolveRecordEventFieldQuery({
      subjectKind: 'base_users',
      field: 'profile.firstname',
    })).toBe('profile.firstname');
  });

  it('uses an explicit fieldMap before the Users catalog', () => {
    expect(resolveRecordEventFieldQuery({
      subjectKind: 'base_sample_mock_records',
      field: 'status',
      fieldMap: { status: 'status_id' },
    })).toBe('status_id');
  });

  it('omits blank filters', () => {
    expect(resolveRecordEventFieldQuery({
      subjectKind: 'base_users',
      field: '  ',
    })).toBeUndefined();
  });

  it('keeps the canonical Users map in sync with form keys', () => {
    expect(USER_PROFILE_HISTORY_FIELD_MAP.firstName).toBe('profile.firstname');
  });
});
