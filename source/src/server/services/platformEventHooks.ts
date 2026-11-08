import { readSettingsObject } from '../config/settingsFile';
import type { ServerFunctionHookConfig } from '../../shared/api/contracts/server-functions/hooks';
import { parseServerFunctionHooks } from '../../shared/api/contracts/server-functions/hooks';
import { fireServerFunctionHook } from './workflow/workflowHookFiring';

/**
 * Optional platform event → workflow hooks for hand-written `base_*` controllers.
 * Config lives in settings under `platform-event-hooks` (no hardcoded workflow keys).
 *
 * Example settings.json fragment:
 * {
 *   "platform-event-hooks": {
 *     "users.roles.updated": {
 *       "after": { "workflowName": "user-roles-changed", "fields": ["userId", "roles"] }
 *     }
 *   }
 * }
 */
export const PLATFORM_EVENT_USERS_ROLES_UPDATED = 'users.roles.updated';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const resolvePlatformEventAfterHook = (
  eventKey: string,
  settingsPath?: string,
): ServerFunctionHookConfig | undefined => {
  const trimmed = String(eventKey || '').trim();
  if (!trimmed) {
    return undefined;
  }

  const settings = readSettingsObject(settingsPath);
  const section = asRecord(settings['platform-event-hooks']);
  if (!section) {
    return undefined;
  }

  const eventConfig = asRecord(section[trimmed]);
  if (!eventConfig) {
    return undefined;
  }

  return parseServerFunctionHooks(eventConfig).after;
};

/** Fire-and-forget after-hook for a platform event when configured in settings. */
export const firePlatformEventAfterHook = (
  eventKey: string,
  payload: Record<string, unknown>,
  settingsPath?: string,
): void => {
  fireServerFunctionHook(resolvePlatformEventAfterHook(eventKey, settingsPath), payload);
};
