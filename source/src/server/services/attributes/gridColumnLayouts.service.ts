import { BUILTIN_USER_ATTRIBUTE_KEYS } from '../../../shared/api/contracts/attributes/builtInAttributes';
import {
  mergeGridColumnLayout,
  normalizeGridColumnLayoutPayload,
  parseUserGridColumnLayouts,
} from '../../../shared/lib/userGridColumnLayouts';
import { findSettingsAttributeByScopeAndKey } from '../../domain/attributes/settingsAttributesRepository';
import {
  listUserAttributeRows,
  upsertUserAttributeValue,
} from '../../domain/attributes/valueRepository';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import { invalidateSessionContext } from './sessionContextCache';
import { parseStoredAttributeValue, serializeAttributeValue } from './valueValidation';

const resolveExistingLayouts = async (userId: number) => {
  const rows = await listUserAttributeRows(userId);
  const row = rows.find((entry) => entry.key === BUILTIN_USER_ATTRIBUTE_KEYS.gridColumnLayouts);
  if (!row) {
    return parseUserGridColumnLayouts(null);
  }
  return parseUserGridColumnLayouts(parseStoredAttributeValue(row.value_text));
};

export async function updateMyGridColumnLayout(
  actor: ActorContext,
  userId: number,
  payload: unknown,
) {
  const normalized = normalizeGridColumnLayoutPayload(
    (payload as { gridId?: unknown } | null)?.gridId,
    (payload as { layout?: unknown } | null)?.layout,
  );
  if (!normalized) {
    return { body: { success: true as const, saved: false as const } };
  }

  const definition = await findSettingsAttributeByScopeAndKey(
    'USER',
    BUILTIN_USER_ATTRIBUTE_KEYS.gridColumnLayouts,
  );
  if (!definition?.id) {
    return { body: { success: true as const, saved: false as const } };
  }

  const existingLayouts = await resolveExistingLayouts(userId);
  const nextLayouts = mergeGridColumnLayout(existingLayouts, normalized.gridId, normalized.layout);

  await upsertUserAttributeValue(
    definition.id,
    userId,
    serializeAttributeValue(nextLayouts),
    actorId(actor),
  );
  await invalidateSessionContext(userId);

  return { body: { success: true as const, saved: true as const } };
}
