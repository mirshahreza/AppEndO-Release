import { RECORD_CHANGE_REASON_REVERTED } from '../../shared/api/contracts/record-events';
import type { RecordEventPublicRow } from '../../shared/api/contracts/record-events';
import { apiPatch, apiPut } from '../../shared/api/client';
import {
  USER_PROFILE_HISTORY_FIELD_MAP,
  USER_PROFILE_TRACKED_FIELDS,
} from '../../shared/lib/recordEventHistoryFields';
import { restoreRecordEventValue } from '../../shared/lib/useRecordSubjectHistory';

export { USER_PROFILE_HISTORY_FIELD_MAP, USER_PROFILE_TRACKED_FIELDS };

const PROFILE_API_FIELDS: Record<string, string> = {
  'profile.firstname': 'firstName',
  'profile.lastname': 'lastName',
  'profile.fathername': 'fatherName',
  'profile.grandfathername': 'grandfatherName',
  'profile.nickname': 'nickname',
  'profile.national_code': 'nationalCode',
  'profile.birth_year': 'birthYear',
  'profile.birth_month': 'birthMonth',
  'profile.birth_day': 'birthDay',
  'profile.gender_code': 'genderCode',
  'profile.company_name': 'companyName',
  'profile.registration_number': 'registrationNumber',
  'profile.website': 'website',
  'profile.phone': 'phone',
};

const restorePayload = (item: RecordEventPublicRow): Record<string, unknown> => ({
  __changeReasonCode: RECORD_CHANGE_REASON_REVERTED,
  __changeReasonText: 'Restored previous value',
  __revertedFromSeq: item.subjectSeq,
  __revertedFromEventId: item.id,
});

export async function restoreUserHistoryEvent(
  userId: number,
  item: RecordEventPublicRow,
): Promise<boolean> {
  const value = restoreRecordEventValue(item.fromValue);
  if (value === undefined || !item.field) return false;
  const extra = restorePayload(item);
  if (item.field.startsWith('profile.')) {
    const apiField = PROFILE_API_FIELDS[item.field];
    if (!apiField) return false;
    await apiPut(`/api/users/${userId}/profile`, { [apiField]: value, ...extra });
    return true;
  }
  if (item.field === 'locked') {
    await apiPatch(`/api/users/${userId}/locked`, { locked: Boolean(value), ...extra });
    return true;
  }
  if (item.field === 'email') {
    await apiPut(`/api/users/${userId}`, { email: value, ...extra });
    return true;
  }
  return false;
}
