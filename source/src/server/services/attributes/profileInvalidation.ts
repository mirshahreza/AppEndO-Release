import { extractProfileColumnsFromPayload } from './profileFields';
import { invalidateSessionContext } from './sessionContextCache';
import { SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET } from '../../../shared/api/contracts/settings/sessionContext';
import { hasActiveProfileFieldSettingsForFields } from '../../domain/profile/profileFieldSettingsRepository';

export async function invalidateSessionContextIfProfileFieldsChanged(
  userId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const changedColumns = extractProfileColumnsFromPayload(payload);
  if (changedColumns.length === 0) {
    return;
  }

  // Shell identity fields are always in session context.
  if (changedColumns.some((column) => SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET.has(column))) {
    await invalidateSessionContext(userId);
    return;
  }

  const shouldInvalidate = await hasActiveProfileFieldSettingsForFields(changedColumns);
  if (shouldInvalidate) {
    await invalidateSessionContext(userId);
  }
}
