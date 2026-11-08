import { BUILTIN_USER_ATTRIBUTE_KEYS } from '../../../shared/api/contracts/attributes/builtInAttributes';
import { normalizeDashboardLayoutPayload } from '../../../shared/lib/userDashboardLayout';
import { ensureBuiltinUserJsonAttribute } from '../../domain/attributes/settingsAttributesRepository';
import {
  listUserAttributeRows,
  upsertUserAttributeValue,
} from '../../domain/attributes/valueRepository';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import { invalidateSessionContext } from './sessionContextCache';
import { parseStoredAttributeValue, serializeAttributeValue } from './valueValidation';

export async function updateMyDashboardLayout(
  actor: ActorContext,
  userId: number,
  payload: unknown,
) {
  const raw = typeof payload === 'string'
    ? (() => {
      try {
        return JSON.parse(payload) as unknown;
      } catch {
        return payload;
      }
    })()
    : payload;
  const normalized = normalizeDashboardLayoutPayload(raw);
  if (!normalized) {
    return { body: { success: false as const, saved: false as const, error: 'Invalid dashboard layout.' } };
  }

  const definitionId = await ensureBuiltinUserJsonAttribute(
    BUILTIN_USER_ATTRIBUTE_KEYS.dashboardLayout,
    'Dashboard Layout',
    actorId(actor),
  );

  await upsertUserAttributeValue(
    definitionId,
    userId,
    serializeAttributeValue(normalized),
    actorId(actor),
  );
  await invalidateSessionContext(userId);

  return { body: { success: true as const, saved: true as const } };
}

export async function readMyDashboardLayout(userId: number) {
  const rows = await listUserAttributeRows(userId);
  const row = rows.find((entry) => entry.key === BUILTIN_USER_ATTRIBUTE_KEYS.dashboardLayout);
  if (!row) {
    return null;
  }
  return parseStoredAttributeValue(row.value_text);
}

export async function getMyDashboardLayout(userId: number) {
  const raw = await readMyDashboardLayout(userId);
  return {
    body: {
      success: true as const,
      layout: normalizeDashboardLayoutPayload(raw),
    },
  };
}
