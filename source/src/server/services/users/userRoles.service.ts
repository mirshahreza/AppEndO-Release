import { findUserId, updateUserUpdatedBy } from '../../domain/users/userRepository';
import {
  assignUserRoles,
  getUserRolesForRequest,
  validateRoles,
} from '../../domain/users/userRoleRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { normalizeRolesInput } from '../../utils/usersHelpers';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import { invalidateUsersListEdgeCache } from '../edgeResponseCache';
import {
  firePlatformEventAfterHook,
  PLATFORM_EVENT_USERS_ROLES_UPDATED,
} from '../platformEventHooks';
import { actorId } from './shared';
import {
  emitUserRolesDiff,
  stripUserHistoryPayload,
} from '../../domain/record-events/userHistory';
import { assertChangeReason, parseChangeReason } from '../../domain/record-events/changeReason';
import { resolveFunctionChangeReason } from '../../domain/record-events/functionChangeReason';
import { normalizeRoleName } from '../../domain/users/roleUtils';
import { USERS_ROLES_CHANGE_REASON } from '../../../shared/api/contracts/record-events';

export async function updateUserRoles(
  actor: ActorContext,
  userId: number,
  payload: Record<string, unknown>,
) {
  const historyPayload = payload;
  payload = stripUserHistoryPayload(payload);
  const roles = normalizeRolesInput(payload.roles, payload.role);

  const existing = await findUserId(userId);
  if (!existing) {
    throw new HttpError(404, 'User not found.');
  }
  const beforeRoles = await getUserRolesForRequest(userId);

  const validation = await validateRoles(roles);
  if (validation.invalid.length > 0) {
    throw new HttpError(400, `Invalid roles: ${validation.invalid.join(', ')}`);
  }

  const policy = await resolveFunctionChangeReason('PUT', '/api/users/:id/roles', USERS_ROLES_CHANGE_REASON);
  const reason = parseChangeReason(undefined, {
    code: typeof historyPayload.__changeReasonCode === 'string' ? historyPayload.__changeReasonCode : null,
    text: typeof historyPayload.__changeReasonText === 'string' ? historyPayload.__changeReasonText : null,
  });
  const beforeSet = new Set(beforeRoles.map((role) => normalizeRoleName(role)).filter(Boolean));
  const afterSet = new Set(roles.map((role) => normalizeRoleName(role)).filter(Boolean));
  const hasRoleDiff = beforeSet.size !== afterSet.size
    || [...afterSet].some((role) => !beforeSet.has(role));
  if (hasRoleDiff) {
    await assertChangeReason({ policy, reason });
  }

  await assignUserRoles(userId, roles);
  await updateUserUpdatedBy(actorId(actor), userId);
  await invalidateSessionContext(userId);
  await invalidateUsersListEdgeCache();

  // SEA-9.2 — optional workflow hook from settings `platform-event-hooks` (no hardcoded workflow key).
  firePlatformEventAfterHook(PLATFORM_EVENT_USERS_ROLES_UPDATED, {
    userId,
    roles,
    actorUserId: actorId(actor),
  });

  await emitUserRolesDiff(userId, beforeRoles, roles, historyPayload, policy);

  return { body: { success: true as const } };
}
