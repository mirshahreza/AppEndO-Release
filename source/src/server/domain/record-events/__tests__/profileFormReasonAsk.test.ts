import { describe, expect, it } from 'vitest';
import { USERS_PROFILE_CHANGE_REASON } from '../../../../shared/api/contracts/record-events';
import { PLATFORM_HISTORY_MARKS } from '../platformHistoryMarks';

describe('Users profile track vs reason', () => {
  it('keeps profile columns track-only', () => {
    const columns = PLATFORM_HISTORY_MARKS.base_users.columns;
    expect(columns['profile.firstname']).toEqual({ track: true });
    expect(columns['profile.national_code']).toEqual({ track: true, redact: true });
    expect(columns.locked).toEqual({ track: true });
    expect(PLATFORM_HISTORY_MARKS.base_users.associations.roles).toEqual({
      trackAssignRemove: true,
    });
  });

  it('asks for a reason on the profile API, not per column', () => {
    expect(USERS_PROFILE_CHANGE_REASON.reasonAsk).toBe('optional');
    expect(USERS_PROFILE_CHANGE_REASON.reasonVocabNodeId).toBe('100.6.22');
  });
});
