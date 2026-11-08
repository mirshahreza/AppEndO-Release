import crypto from 'node:crypto';
import {
  ROLE_CATALOG_CHANGE_REASON,
  USERS_PROFILE_CHANGE_REASON,
  USERS_ROLES_CHANGE_REASON,
  USERS_SCOPE_CHANGE_REASON,
} from '../../../shared/api/contracts/record-events';
import type { ChangeReasonPolicy } from '../../../shared/api/contracts/record-events';
import { IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS } from '../../../shared/api/contracts/client-context';
import { prisma, fromUserId, toUserId } from '../users/prismaHelpers';
import { stripReservedClientKeys } from '../client-context/collectClientContext';
import { assertChangeReason, parseChangeReason, type ChangeReason } from './changeReason';
import { emitRecordEvent } from './emitRecordEvent';
import { getPlatformHistoryMark, valuesEqual } from './platformHistoryMarks';

const USER_MARK = () => getPlatformHistoryMark('base_users')!;
const ROLE_MARK = () => getPlatformHistoryMark('base_roles')!;

const PROFILE_FIELDS = [
  'firstname',
  'lastname',
  'company_name',
  'phone',
  'national_code',
  'registration_number',
  'gender_code',
  'nickname',
  'website',
  'fathername',
  'grandfathername',
  'birth_year',
  'birth_month',
  'birth_day',
] as const;

export type UserHistorySnapshot = {
  id: number;
  username: string;
  email: string | null;
  mobile: string | null;
  locked: number | boolean;
  email_verified_at: Date | string | null;
  mobile_verified_at: Date | string | null;
  roles: string[];
  profile: Record<string, unknown>;
};

const scalar = (value: unknown): RecordEventValue => ({ value: value ?? null });
const assoc = (id: string, label?: string): RecordEventValue => ({ id, label: label ?? id });

export const loadUserHistorySnapshot = async (userId: number): Promise<UserHistorySnapshot | null> => {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: {
      id: true,
      username: true,
      email: true,
      mobile: true,
      locked: true,
      emailVerifiedAt: true,
      mobileVerifiedAt: true,
      userRoles: { select: { roleName: true } },
      profile: true,
    },
  });
  if (!row) return null;
  const profile = row.profile ?? {};
  return {
    id: fromUserId(row.id),
    username: row.username,
    email: row.email,
    mobile: row.mobile,
    locked: row.locked,
    email_verified_at: row.emailVerifiedAt,
    mobile_verified_at: row.mobileVerifiedAt,
    roles: row.userRoles.map((item) => item.roleName),
    profile: {
      firstname: profile.firstname ?? null,
      lastname: profile.lastname ?? null,
      company_name: profile.companyName ?? null,
      phone: profile.phone ?? null,
      national_code: profile.nationalCode ?? null,
      registration_number: profile.registrationNumber ?? null,
      gender_code: profile.genderCode ?? null,
      nickname: profile.nickname ?? null,
      website: profile.website ?? null,
      fathername: profile.fathername ?? null,
      grandfathername: profile.grandfathername ?? null,
      birth_year: profile.birthYear ?? null,
      birth_month: profile.birthMonth ?? null,
      birth_day: profile.birthDay ?? null,
    },
  };
};

const emitUserChange = async (input: {
  userId: number;
  eventKind: RecordEventKind;
  field: string;
  fromValue?: RecordEventValue | null;
  toValue?: RecordEventValue | null;
  redact?: boolean;
  reason: ChangeReason;
  correlationId: string;
  source?: 'patch' | 'workflow';
  payload?: Record<string, unknown> | null;
}) => {
  await emitRecordEvent({
    subjectKind: 'base_users',
    subjectId: String(input.userId),
    eventKind: input.eventKind,
    source: input.source ?? 'patch',
    field: input.field,
    fromValue: input.fromValue,
    toValue: input.toValue,
    redact: input.redact,
    reasonCode: input.reason.code,
    reasonText: input.reason.text,
    correlationId: input.correlationId,
    clientContextFields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS,
    historyEnabled: true,
    payload: input.payload,
  });
};

export const emitUserCreatedHistory = async (
  userId: number,
  payload: Record<string, unknown>,
) => {
  const reason = parseChangeReason(undefined, {
    code: typeof payload.__changeReasonCode === 'string' ? payload.__changeReasonCode : null,
    text: typeof payload.__changeReasonText === 'string' ? payload.__changeReasonText : null,
  });
  const correlationId = crypto.randomUUID();
  await emitRecordEvent({
    subjectKind: 'base_users',
    subjectId: String(userId),
    eventKind: 'created',
    source: 'patch',
    correlationId,
    clientContextFields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS,
    historyEnabled: true,
    reasonCode: reason.code,
    reasonText: reason.text,
  });
  const roles = Array.isArray(payload.roles)
    ? (payload.roles as unknown[]).map(String)
    : payload.role
      ? [String(payload.role)]
      : [];
  for (const role of roles) {
    await emitUserChange({
      userId,
      eventKind: 'association.added',
      field: 'roles',
      toValue: assoc(role),
      reason,
      correlationId,
    });
  }
};

export const emitUserDeletedHistory = async (
  userId: number,
  policy: ChangeReasonPolicy = USERS_PROFILE_CHANGE_REASON,
) => {
  const reason = parseChangeReason();
  await assertChangeReason({ policy, reason });
  await emitRecordEvent({
    subjectKind: 'base_users',
    subjectId: String(userId),
    eventKind: 'deleted',
    source: 'patch',
    clientContextFields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS,
    historyEnabled: true,
    reasonCode: reason.code,
    reasonText: reason.text,
  });
};

export const emitUserSnapshotDiff = async (
  before: UserHistorySnapshot,
  after: UserHistorySnapshot,
  payload: Record<string, unknown> = {},
  policy: ChangeReasonPolicy = USERS_PROFILE_CHANGE_REASON,
) => {
  const reason = parseChangeReason(undefined, {
    code: typeof payload.__changeReasonCode === 'string' ? payload.__changeReasonCode : null,
    text: typeof payload.__changeReasonText === 'string' ? payload.__changeReasonText : null,
  });
  await assertChangeReason({ policy, reason });
  const correlationId = crypto.randomUUID();
  const revertPayload = payload.__revertedFromSeq != null
    ? {
      revertedFromSeq: payload.__revertedFromSeq,
      revertedFromEventId: payload.__revertedFromEventId ?? null,
    }
    : null;
  const columns = USER_MARK().columns;
  const userFields: Array<keyof UserHistorySnapshot> = [
    'username', 'email', 'mobile', 'locked', 'email_verified_at', 'mobile_verified_at',
  ];
  for (const field of userFields) {
    const history = columns[field];
    if (!history?.track) continue;
    if (valuesEqual(before[field], after[field])) continue;
    const eventKind: RecordEventKind = field === 'locked' ? 'status.changed' : 'field.changed';
    await emitUserChange({
      userId: after.id,
      eventKind,
      field,
      fromValue: scalar(before[field]),
      toValue: scalar(after[field]),
      redact: Boolean(history.redact),
      reason,
      correlationId,
      payload: revertPayload,
    });
  }

  const beforeRoles = before.roles;
  const afterRoles = after.roles;
  const beforeSet = new Set(beforeRoles);
  const afterSet = new Set(afterRoles);
  const addedRoles = afterRoles.filter((role) => !beforeSet.has(role));
  const removedRoles = beforeRoles.filter((role) => !afterSet.has(role));
  if (addedRoles.length || removedRoles.length) {
    for (const role of addedRoles) {
      await emitUserChange({
        userId: after.id,
        eventKind: 'association.added',
        field: 'roles',
        toValue: assoc(role),
        reason,
        correlationId,
      });
    }
    for (const role of removedRoles) {
      await emitUserChange({
        userId: after.id,
        eventKind: 'association.removed',
        field: 'roles',
        fromValue: assoc(role),
        reason,
        correlationId,
      });
    }
  }

  for (const profileKey of PROFILE_FIELDS) {
    const markKey = `profile.${profileKey}`;
    const history = columns[markKey];
    if (!history?.track) continue;
    const beforeVal = before.profile[profileKey];
    const afterVal = after.profile[profileKey];
    if (valuesEqual(beforeVal, afterVal)) continue;
    await emitUserChange({
      userId: after.id,
      eventKind: 'field.changed',
      field: markKey,
      fromValue: scalar(beforeVal),
      toValue: scalar(afterVal),
      redact: Boolean(history.redact),
      reason,
      correlationId,
      payload: revertPayload,
    });
  }
};

export const emitUserRolesDiff = async (
  userId: number,
  beforeRoles: string[],
  afterRoles: string[],
  payload: Record<string, unknown> = {},
  policy: ChangeReasonPolicy = USERS_ROLES_CHANGE_REASON,
) => {
  const reason = parseChangeReason(undefined, {
    code: typeof payload.__changeReasonCode === 'string' ? payload.__changeReasonCode : null,
    text: typeof payload.__changeReasonText === 'string' ? payload.__changeReasonText : null,
  });
  const beforeSet = new Set(beforeRoles);
  const afterSet = new Set(afterRoles);
  const added = afterRoles.filter((role) => !beforeSet.has(role));
  const removed = beforeRoles.filter((role) => !afterSet.has(role));
  if (added.length === 0 && removed.length === 0) return;
  await assertChangeReason({ policy, reason });
  const correlationId = crypto.randomUUID();
  for (const role of added) {
    await emitUserChange({
      userId,
      eventKind: 'association.added',
      field: 'roles',
      toValue: assoc(role),
      reason,
      correlationId,
    });
  }
  for (const role of removed) {
    await emitUserChange({
      userId,
      eventKind: 'association.removed',
      field: 'roles',
      fromValue: assoc(role),
      reason,
      correlationId,
    });
  }
};

export const emitUserScopeDiff = async (input: {
  userId: number;
  dimensionKey: string;
  nodeId: string;
  added: boolean;
}) => {
  const reason = parseChangeReason();
  await assertChangeReason({ policy: USERS_SCOPE_CHANGE_REASON, reason });
  await emitUserChange({
    userId: input.userId,
    eventKind: input.added ? 'association.added' : 'association.removed',
    field: `scope.${input.dimensionKey}`,
    fromValue: input.added ? null : assoc(input.nodeId),
    toValue: input.added ? assoc(input.nodeId) : null,
    reason,
    correlationId: crypto.randomUUID(),
  });
};

export const emitRoleCatalogDiff = async (
  roleName: string,
  before: { name: string; note: unknown },
  after: { name: string; note: unknown },
  payload: Record<string, unknown> = {},
) => {
  const reason = parseChangeReason(undefined, {
    code: typeof payload.__changeReasonCode === 'string' ? payload.__changeReasonCode : null,
    text: typeof payload.__changeReasonText === 'string' ? payload.__changeReasonText : null,
  });
  await assertChangeReason({ policy: ROLE_CATALOG_CHANGE_REASON, reason });
  const correlationId = crypto.randomUUID();
  const columns = ROLE_MARK().columns;
  if (!valuesEqual(before.name, after.name) && columns.name?.track) {
    await emitRecordEvent({
      subjectKind: 'base_roles',
      subjectId: after.name,
      eventKind: 'field.changed',
      source: 'patch',
      field: 'name',
      fromValue: scalar(before.name),
      toValue: scalar(after.name),
      reasonCode: reason.code,
      reasonText: reason.text,
      correlationId,
      clientContextFields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS,
      historyEnabled: true,
    });
  }
  if (!valuesEqual(before.note, after.note) && columns.note?.track) {
    await emitRecordEvent({
      subjectKind: 'base_roles',
      subjectId: after.name,
      eventKind: 'field.changed',
      source: 'patch',
      field: 'note',
      fromValue: scalar(before.note),
      toValue: scalar(after.note),
      correlationId,
      clientContextFields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS,
      historyEnabled: true,
    });
  }
};

export const stripUserHistoryPayload = (payload: Record<string, unknown>): Record<string, unknown> => (
  stripReservedClientKeys(payload) as Record<string, unknown>
);
