import { describe, expect, it } from 'vitest';
import { withCanonicalSessionContextGroups } from '../useSessionContextSettingsDraft';

describe('withCanonicalSessionContextGroups', () => {
  it('always injects locked shell identity with client and server checked', () => {
    const groups = withCanonicalSessionContextGroups([
      {
        id: 'user_account',
        title: 'User account fields',
        description: 'stale',
        entries: [
          {
            id: 'user:username',
            kind: 'user_account',
            label: 'Username',
            contextKey: 'user.username',
            server: false,
            client: false,
            locked: false,
          },
        ],
      },
      {
        id: 'profile_field',
        title: 'Profile fields',
        description: 'stale',
        entries: [
          {
            id: 'profile:firstname',
            kind: 'profile_field',
            label: 'First name',
            contextKey: 'user.firstname',
            server: false,
            client: false,
            locked: false,
          },
          {
            id: 'profile:phone',
            kind: 'profile_field',
            label: 'Phone',
            contextKey: 'user.phone',
            server: true,
            client: false,
            locked: false,
          },
        ],
      },
    ]);

    expect(groups[0]?.id).toBe('shell_identity');
    expect(groups[1]?.id).toBe('system');
    expect(groups[2]?.id).toBe('record_scope');
    const shell = groups[0]!;
    const byKey = Object.fromEntries(shell.entries.map((entry) => [entry.contextKey, entry]));

    for (const key of ['user.username', 'user.firstname', 'user.lastname', 'user.profile_image']) {
      expect(byKey[key]).toMatchObject({
        locked: true,
        server: true,
        client: true,
      });
    }

    const profileGroup = groups.find((group) => group.id === 'profile_field');
    expect(profileGroup?.entries.map((entry) => entry.id)).toEqual(['profile:phone']);
    const accountGroup = groups.find((group) => group.id === 'user_account');
    expect(accountGroup?.entries ?? []).toEqual([]);
  });
});
