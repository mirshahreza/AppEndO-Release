import { describe, expect, it } from 'vitest';
import { collectExcludedAccessAssistantPageKeys } from '../excludedNavPageKeys';
import type { NavigationManifest } from '../../../api/contracts/platform/navigation';

describe('collectExcludedAccessAssistantPageKeys', () => {
  it('collects page keys under Development and Extensions only', () => {
    const manifest: NavigationManifest = {
      id: 'studio',
      groups: [
        {
          heading: 'Development',
          items: [{ pageKey: 'server-functions', routePattern: 'server-functions' }],
        },
        {
          heading: 'Records',
          items: [{ pageKey: 'users', routePattern: 'users' }],
        },
        {
          heading: 'Extensions',
          items: [{ pageKey: 'package-manager', routePattern: 'package-manager' }],
        },
      ],
    };

    const excluded = collectExcludedAccessAssistantPageKeys(manifest);
    expect(excluded.has('server-functions')).toBe(true);
    expect(excluded.has('package-manager')).toBe(true);
    expect(excluded.has('users')).toBe(false);
  });
});
