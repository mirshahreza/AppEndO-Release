import type {
  EdgeAssociationHistory,
  EdgeColumnHistory,
  EdgeModelHistory,
} from '../../../shared/api/contracts/record-events';
import { HWY_MEMBER_HISTORY_COLUMN_MARKS } from './hwyMemberHistoryFields';

const track = (): EdgeColumnHistory => ({ track: true });
const trackRedact = (): EdgeColumnHistory => ({ track: true, redact: true });
const assocTrack = (): EdgeAssociationHistory => ({ trackAssignRemove: true });

export type PlatformHistoryMark = {
  objectName: string;
  history: EdgeModelHistory;
  columns: Record<string, EdgeColumnHistory>;
  associations: Record<string, EdgeAssociationHistory>;
};

export const PLATFORM_HISTORY_MARKS: Record<string, PlatformHistoryMark> = {
  base_users: {
    objectName: 'base_users',
    history: { enabled: true, lifecycleField: 'locked' },
    columns: {
      username: track(),
      email: trackRedact(),
      mobile: trackRedact(),
      locked: track(),
      email_verified_at: track(),
      mobile_verified_at: track(),
      'profile.firstname': track(),
      'profile.lastname': track(),
      'profile.company_name': track(),
      'profile.phone': trackRedact(),
      'profile.national_code': trackRedact(),
      'profile.registration_number': trackRedact(),
      'profile.gender_code': track(),
      'profile.nickname': track(),
      'profile.website': track(),
      'profile.fathername': track(),
      'profile.grandfathername': track(),
      'profile.birth_year': track(),
      'profile.birth_month': track(),
      'profile.birth_day': track(),
      'profile.organization_user_id': track(),
    },
    associations: {
      roles: assocTrack(),
      scope: assocTrack(),
      identities: assocTrack(),
    },
  },
  base_roles: {
    objectName: 'base_roles',
    history: { enabled: true },
    columns: {
      name: track(),
      note: track(),
    },
    associations: {
      mcp_grants: assocTrack(),
      scope: assocTrack(),
    },
  },
  hwy_members: {
    objectName: 'hwy_members',
    history: { enabled: true, lifecycleField: 'membership_status_code' },
    columns: HWY_MEMBER_HISTORY_COLUMN_MARKS,
    associations: {},
  },
  base_sample_mock_records: {
    objectName: 'base_sample_mock_records',
    history: { enabled: true, lifecycleField: 'status_id' },
    columns: {
      title: track(),
      status_id: track(),
      locked: track(),
      owner_id: track(),
      parent_id: track(),
      code: track(),
      'detail.city': track(),
    },
    associations: {
      tags: assocTrack(),
    },
  },
};

export const getPlatformHistoryMark = (objectName: string): PlatformHistoryMark | undefined => (
  PLATFORM_HISTORY_MARKS[objectName]
);

export const isHistoryUnmarked = (meta: {
  history?: EdgeModelHistory | null;
  columnMeta?: Array<{ history?: EdgeColumnHistory }>;
  associationMeta?: Array<{ history?: EdgeAssociationHistory }>;
}): boolean => {
  if (meta.history) return false;
  if (meta.columnMeta?.some((column) => column.history)) return false;
  if (meta.associationMeta?.some((association) => association.history)) return false;
  return true;
};

export const valuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null && right == null) return true;
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (typeof left === 'object' || typeof right === 'object') {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  return String(left) === String(right);
};
