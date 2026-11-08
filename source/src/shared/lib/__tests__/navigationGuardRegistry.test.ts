import { describe, expect, it, vi } from 'vitest';
import {
  navigationGuardRegistry,
  normalizeNavigationPath,
} from '../navigationGuardRegistry';

describe('navigationGuardRegistry', () => {
  it('normalizes paths without query or trailing slash', () => {
    expect(normalizeNavigationPath('/studio/client-components?path=foo')).toBe('/studio/client-components');
    expect(normalizeNavigationPath('/studio/client-components/')).toBe('/studio/client-components');
  });

  it('blocks navigation and defers proceed until guard callback runs it', () => {
    const proceed = vi.fn();
    const onBlock = vi.fn();

    const unregister = navigationGuardRegistry.register({
      id: 'test-guard',
      shouldBlock: ({ fromPath, toPath }) => fromPath === '/studio/client-components' && toPath === '/studio/users',
      onBlock: ({ proceed: continueNavigation }) => {
        onBlock();
        continueNavigation();
      },
    });

    const blocked = navigationGuardRegistry.runGuards('/studio/client-components', '/studio/users', proceed);

    expect(blocked).toBe(true);
    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(proceed).toHaveBeenCalledTimes(1);

    unregister();
  });
});
