import { describe, expect, it } from 'vitest';

import {
  HWY_MEMBER_LEGACY_CHANGE_JSON_FIELD_MAP,
} from '../hwyMemberHistoryFields';
import { getPlatformHistoryMark } from '../platformHistoryMarks';

describe('hwyMemberHistoryFields', () => {
  it('maps every legacy ChangeHistory JSON key to a tracked platform field', () => {
    const mark = getPlatformHistoryMark('hwy_members');
    expect(mark?.history.enabled).toBe(true);

    const legacyKeys = [
      'FirstName',
      'LastName',
      'FatherName',
      'GrandFatherName',
      'Phone1',
      'Phone2',
      'AddrStateId',
      'EducationLevelId',
      'JobTypeId',
    ];

    for (const legacyKey of legacyKeys) {
      const mapping = HWY_MEMBER_LEGACY_CHANGE_JSON_FIELD_MAP[legacyKey];
      expect(mapping, legacyKey).toBeDefined();
      expect(mark?.columns[mapping.field]?.track).toBe(true);
    }

    expect(mark?.columns.phone1?.redact).toBe(true);
    expect(mark?.columns.phone2?.redact).toBe(true);
  });
});
