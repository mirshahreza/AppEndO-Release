import { hashPassword } from '../../utils/bcryptAsync';
import { DEFAULT_ASSIGNABLE_ROLE } from '../../../shared/api/contracts/roles/constants';
import {
  deleteUser,
  deleteUserProfile,
  findUserId,
  findUserIdBuiltin,
  findUserIdEmailUsername,
  findUserIdByUsername,
  insertUser,
  listUsersFilteredRows,
  updateUserEmail,
  updateUserPasswordHash,
} from '../../domain/users/userRepository';
import {
  assignUserRoles,
  getUserRolesForRequest,
  validateRoles,
} from '../../domain/users/userRoleRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { ensureBaseInfoCode } from '../../utils/baseInfoValidation';
import {
  BASE_INFO_ROOT_GENDER,
  BASE_INFO_ROOT_PERSON_TYPE,
  hasProfilePayloadValue,
  normalizeProfilePayload,
} from '../../utils/profilePayload';
import {
  assertPersonTypeCodeRequiredOnCreate,
  assertPersonTypeCodeUnchanged,
} from '../../utils/profilePersonTypeGuard';
import { normalizeRolesInput, toOptionalTrimmed } from '../../utils/usersHelpers';
import { actorId } from './shared';
import { upsertUserProfile } from './userProfile.service';
import { invalidateSessionContextIfProfileFieldsChanged } from '../attributes/profileInvalidation';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import { parseUsersListQuery } from '../../../shared/api/contracts/users/listQuery';
import { resolveUserAvatarXsSrc } from '../../../shared/api/contracts/users/avatar';
import { invalidateUsersListEdgeCache } from '../edgeResponseCache';
import { getUserProfileAvatarListMeta } from '../../domain/users/userProfileRepository';
import { resolveAvatarUsernamesForUserIds } from '../../domain/users/hwyMemberUsernameLookup';
import { invalidateUserRolesCache } from '../../domain/users/userRolesCache';
import {
  emitUserCreatedHistory,
  emitUserDeletedHistory,
  emitUserSnapshotDiff,
  loadUserHistorySnapshot,
  stripUserHistoryPayload,
} from '../../domain/record-events/userHistory';
import { resolveFunctionChangeReason } from '../../domain/record-events/functionChangeReason';
import { USERS_PROFILE_CHANGE_REASON } from '../../../shared/api/contracts/record-events';

const touchUsersListEdgeCache = async () => {
  await invalidateUsersListEdgeCache();
};

export async function listUsers(rawQuery: Record<string, unknown> = {}) {
  const query = parseUsersListQuery(rawQuery);
  const { items: rows, totalCount } = await listUsersFilteredRows(query);
  const avatarUsernameByUserId = await resolveAvatarUsernamesForUserIds(
    rows.map((row) => ({ id: row.id, username: row.username })),
  );

  const items = rows.map((row) => ({
    ...row,
    avatar_username: avatarUsernameByUserId.get(row.id) ?? null,
    legacy_hwy_username: avatarUsernameByUserId.get(row.id) ?? null,
    membership_username: avatarUsernameByUserId.get(row.id) ?? null,
    avatar_url: resolveUserAvatarXsSrc({
      id: row.id,
      has_profile_image_xs: row.has_profile_image_xs,
      profile_image_size: row.profile_image_size,
      profile_updated_at: row.profile_updated_at,
    }),
    locked: Boolean(row.locked),
    locked_at: row.locked_at ?? null,
    locked_by: row.locked_by ?? null,
    locked_by_username: row.locked_by_username ?? null,
    unlocked_at: row.unlocked_at ?? null,
    unlocked_by: row.unlocked_by ?? null,
    unlocked_by_username: row.unlocked_by_username ?? null,
    is_builtin: Boolean(row.is_builtin),
    roles: row.roles,
    role: row.role,
  }));

  return { body: { success: true as const, items, totalCount } };
}

export async function createUser(
  actor: ActorContext,
  payload: Record<string, unknown>,
) {
  const role = payload.role;
  const roles = payload.roles;
  const rawUsername = toOptionalTrimmed(payload.username);
  const rawEmail = toOptionalTrimmed(payload.email);
  const passwordText = String(payload.password || '');

  if (!passwordText) {
    throw new HttpError(400, 'password is required.');
  }
  if (!rawUsername && !rawEmail) {
    throw new HttpError(400, 'username or email is required.');
  }

  const normalizedRoles = Array.isArray(roles)
    ? normalizeRolesInput(roles, role)
    : normalizeRolesInput(roles, role ?? DEFAULT_ASSIGNABLE_ROLE);
  const validation = await validateRoles(normalizedRoles);
  if (validation.invalid.length > 0) {
    throw new HttpError(400, `Invalid roles: ${validation.invalid.join(', ')}`);
  }

  const profile = normalizeProfilePayload(payload);
  assertPersonTypeCodeRequiredOnCreate(profile.personTypeCode);
  await ensureBaseInfoCode(profile.genderCode, BASE_INFO_ROOT_GENDER, 'genderCode');
  await ensureBaseInfoCode(profile.personTypeCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');

  const resolvedUsername = (rawUsername || rawEmail?.split('@')[0] || '').trim().toLowerCase();
  const resolvedEmail = rawEmail || null;
  const hash = await hashPassword(passwordText);
  const currentActorId = actorId(actor);

  await insertUser(resolvedUsername, resolvedEmail, hash, currentActorId);

  const insertedUser = await findUserIdByUsername(resolvedUsername);
  const userId = Number(insertedUser?.id || 0);
  if (!userId) {
    throw new Error('Failed to resolve created user id.');
  }

  await assignUserRoles(userId, normalizedRoles);

  if (hasProfilePayloadValue(profile)) {
    await upsertUserProfile(userId, profile, currentActorId, { useNullFallbackForImages: true });
  }

  await touchUsersListEdgeCache();

  await emitUserCreatedHistory(userId, payload);

  return { statusCode: 201, body: { success: true as const, id: userId } };
}

export async function updateUser(
  actor: ActorContext,
  userId: number,
  payload: Record<string, unknown>,
) {
  const historyPayload = payload;
  payload = stripUserHistoryPayload(payload);
  const email = toOptionalTrimmed(payload.email);
  const role = payload.role;
  const roles = payload.roles;
  const passwordText = toOptionalTrimmed(payload.password);

  const existing = await findUserIdEmailUsername(userId);
  if (!existing) {
    throw new HttpError(404, 'User not found.');
  }
  const before = await loadUserHistorySnapshot(userId);

  const existingRoles = await getUserRolesForRequest(userId);
  const normalizedRoles = (roles !== undefined || role !== undefined)
    ? normalizeRolesInput(roles, role)
    : existingRoles;
  const validation = await validateRoles(normalizedRoles);
  if (validation.invalid.length > 0) {
    throw new HttpError(400, `Invalid roles: ${validation.invalid.join(', ')}`);
  }

  const profile = normalizeProfilePayload(payload);
  await assertPersonTypeCodeUnchanged(userId, profile.personTypeCode);
  await ensureBaseInfoCode(profile.genderCode, BASE_INFO_ROOT_GENDER, 'genderCode');
  await ensureBaseInfoCode(profile.personTypeCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');

  const nextEmail = Object.prototype.hasOwnProperty.call(payload, 'email') ? email : existing.email;
  const currentActorId = actorId(actor);
  await updateUserEmail(nextEmail, currentActorId, userId);

  if (roles !== undefined || role !== undefined) {
    await assignUserRoles(userId, normalizedRoles);
  }

  if (passwordText) {
    await updateUserPasswordHash(await hashPassword(passwordText), userId);
  }

  await upsertUserProfile(userId, profile, currentActorId, { useNullFallbackForImages: true });

  await touchUsersListEdgeCache();

  const after = await loadUserHistorySnapshot(userId);
  if (before && after) {
    const policy = await resolveFunctionChangeReason('PUT', '/api/users/:id', USERS_PROFILE_CHANGE_REASON);
    await emitUserSnapshotDiff(before, after, historyPayload, policy);
  }

  return { body: { success: true as const } };
}

export async function deleteUserRecord(userId: number) {
  const existing = await findUserIdBuiltin(userId);
  if (!existing) {
    throw new HttpError(404, 'User not found.');
  }
  if (existing.is_builtin) {
    throw new HttpError(400, 'Built-in users cannot be deleted.');
  }

  await deleteUserProfile(userId);
  await deleteUser(userId);
  const policy = await resolveFunctionChangeReason('DELETE', '/api/users/:id', USERS_PROFILE_CHANGE_REASON);
  await emitUserDeletedHistory(userId, policy);

  await Promise.all([
    invalidateSessionContext(userId),
    invalidateUserRolesCache(userId),
    touchUsersListEdgeCache(),
  ]);

  return { body: { success: true as const } };
}

export async function updateUserProfileOnly(
  actor: ActorContext,
  userId: number,
  payload: Record<string, unknown>,
) {
  const historyPayload = payload;
  payload = stripUserHistoryPayload(payload);
  const existing = await findUserId(userId);
  if (!existing) {
    throw new HttpError(404, 'User not found.');
  }
  const before = await loadUserHistorySnapshot(userId);

  const profile = normalizeProfilePayload(payload);
  await assertPersonTypeCodeUnchanged(userId, profile.personTypeCode);
  await ensureBaseInfoCode(profile.genderCode, BASE_INFO_ROOT_GENDER, 'genderCode');
  await ensureBaseInfoCode(profile.personTypeCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');

  await upsertUserProfile(userId, profile, actorId(actor), { useNullFallbackForImages: true });
  await invalidateSessionContextIfProfileFieldsChanged(userId, payload);

  await touchUsersListEdgeCache();

  const after = await loadUserHistorySnapshot(userId);
  if (before && after) {
    const policy = await resolveFunctionChangeReason('PUT', '/api/users/:id/profile', USERS_PROFILE_CHANGE_REASON);
    await emitUserSnapshotDiff(before, after, historyPayload, policy);
  }

  const profileMeta = await getUserProfileAvatarListMeta(userId);

  return { body: { success: true as const, profile: profileMeta } };
}
