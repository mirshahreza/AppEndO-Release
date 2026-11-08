import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSettingsObject = vi.fn(() => ({} as Record<string, unknown>));
const fireServerFunctionHook = vi.fn();

vi.mock('../../config/settingsFile', () => ({
  readSettingsObject: (...args: unknown[]) => readSettingsObject(...args),
}));

vi.mock('../workflow/workflowHookFiring', () => ({
  fireServerFunctionHook: (...args: unknown[]) => fireServerFunctionHook(...args),
}));

import {
  firePlatformEventAfterHook,
  PLATFORM_EVENT_USERS_ROLES_UPDATED,
  resolvePlatformEventAfterHook,
} from '../platformEventHooks';

describe('platformEventHooks (SEA-9.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSettingsObject.mockReturnValue({});
  });

  it('returns undefined when the event is not configured', () => {
    expect(resolvePlatformEventAfterHook(PLATFORM_EVENT_USERS_ROLES_UPDATED)).toBeUndefined();
  });

  it('resolves after hook config from settings without hardcoding workflow names', () => {
    readSettingsObject.mockReturnValue({
      'platform-event-hooks': {
        [PLATFORM_EVENT_USERS_ROLES_UPDATED]: {
          after: { workflowName: 'user-roles-changed', fields: ['userId', 'roles'] },
        },
      },
    });

    expect(resolvePlatformEventAfterHook(PLATFORM_EVENT_USERS_ROLES_UPDATED)).toEqual({
      workflowName: 'user-roles-changed',
      fields: ['userId', 'roles'],
    });
  });

  it('fires the after hook when configured', () => {
    readSettingsObject.mockReturnValue({
      'platform-event-hooks': {
        [PLATFORM_EVENT_USERS_ROLES_UPDATED]: {
          after: { workflowName: 'user-roles-changed', fields: ['userId', 'roles'] },
        },
      },
    });

    firePlatformEventAfterHook(PLATFORM_EVENT_USERS_ROLES_UPDATED, {
      userId: 9,
      roles: ['DEVELOPER'],
    });

    expect(fireServerFunctionHook).toHaveBeenCalledWith(
      { workflowName: 'user-roles-changed', fields: ['userId', 'roles'] },
      { userId: 9, roles: ['DEVELOPER'] },
    );
  });

  it('does not fire when settings omit the event', () => {
    firePlatformEventAfterHook(PLATFORM_EVENT_USERS_ROLES_UPDATED, { userId: 1, roles: [] });
    expect(fireServerFunctionHook).toHaveBeenCalledWith(undefined, { userId: 1, roles: [] });
  });
});
