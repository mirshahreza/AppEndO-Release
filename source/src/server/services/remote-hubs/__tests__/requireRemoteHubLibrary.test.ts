import { describe, expect, it } from 'vitest';
import {
  isRemoteHubLibraryInstalled,
  requireRemoteHubLibrary,
} from '../requireRemoteHubLibrary';

describe('requireRemoteHubLibrary', () => {
  it('throws a package-aware error for a missing specifier', () => {
    expect(() => requireRemoteHubLibrary('appendo-remote-hubs-missing-lib')).toThrow(
      /Install the Remote Hubs package/,
    );
  });

  it.skipIf(!isRemoteHubLibraryInstalled('ssh2'))('loads ssh2 from packages-storage/libs', () => {
    const ssh2 = requireRemoteHubLibrary<{ Client: unknown }>('ssh2');
    expect(ssh2.Client).toBeTypeOf('function');
  });
});
