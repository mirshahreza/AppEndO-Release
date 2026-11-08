import {
  findUserId,
  findUserIdBuiltin,
  lockUser,
  revokeUserRefreshTokens,
  unlockUser,
} from '../../domain/users/userRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from './shared';
import { invalidateUsersListEdgeCache } from '../edgeResponseCache';
import { USERS_LOCK_CHANGE_REASON } from '../../../shared/api/contracts/record-events';
import {
  emitUserSnapshotDiff,
  loadUserHistorySnapshot,
} from '../../domain/record-events/userHistory';
import { resolveFunctionChangeReason } from '../../domain/record-events/functionChangeReason';

export async function lockUserAccount(
  actor: ActorContext,
  userId: number,
) {
  const user = await findUserIdBuiltin(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  if (user.is_builtin) {
    throw new HttpError(400, 'Built-in users cannot be locked.');
  }

  const before = await loadUserHistorySnapshot(userId);
  await lockUser(actorId(actor), userId);

  await invalidateUsersListEdgeCache();
  const after = await loadUserHistorySnapshot(userId);
  if (before && after) {
    const policy = await resolveFunctionChangeReason('PATCH', '/api/users/:id/lock', USERS_LOCK_CHANGE_REASON);
    await emitUserSnapshotDiff(before, after, {}, policy);
  }

  return { body: { success: true as const } };
}

export async function unlockUserAccount(
  actor: ActorContext,
  userId: number,
) {
  const user = await findUserId(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const before = await loadUserHistorySnapshot(userId);
  await unlockUser(actorId(actor), userId);

  await invalidateUsersListEdgeCache();
  const after = await loadUserHistorySnapshot(userId);
  if (before && after) {
    const policy = await resolveFunctionChangeReason('PATCH', '/api/users/:id/unlock', USERS_LOCK_CHANGE_REASON);
    await emitUserSnapshotDiff(before, after, {}, policy);
  }

  return { body: { success: true as const } };
}

export async function setUserLockedState(
  actor: ActorContext,
  userId: number,
  locked: boolean,
) {
  if (locked) {
    const result = await lockUserAccount(actor, userId);
    await revokeUserRefreshTokens(userId);
    return result;
  }

  return unlockUserAccount(actor, userId);
}
