import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  deleteShellFile: vi.fn(),
  listShellFiles: vi.fn(() => []),
  readShellFile: vi.fn(),
  touchPlatformRegistryIndex: vi.fn(),
  withPlatformRegistryLock: <T,>(fn: () => T) => fn(),
  writeShellFile: vi.fn(),
}));

import { readShellFile, writeShellFile } from '../../../../core/platform-registry/PlatformRegistryFileStore';
import { updatePlatformShell } from '../shellRepository';

describe('updatePlatformShell auth patch', () => {
  const current = {
    shellKey: 'my-portal',
    name: 'My Portal',
    entry: 'designer:portal-layouts/my-portal',
    surface: 'studio',
    enabled: true,
    entryMode: 'shell' as const,
    redirectToSegment: null,
    redirectToCulture: null,
    navigationRef: 'my-portal',
    auth: {
      accessMode: 'authenticated' as const,
      allowRoles: [] as string[],
      allowUsers: [] as string[],
      denyRoles: [] as string[],
      denyUsers: [] as string[],
    },
    source: 'experience-manifest',
  };

  beforeEach(() => {
    vi.mocked(readShellFile).mockReturnValue({ ...current });
    vi.mocked(writeShellFile).mockClear();
  });

  it('writes null auth when the operator chooses public access', async () => {
    await updatePlatformShell(
      'my-portal',
      {
        name: current.name,
        entry: current.entry,
        surface: current.surface,
        enabled: current.enabled,
        entryMode: 'shell',
        auth: null,
      },
      { userId: 1, username: 'admin' },
    );

    expect(writeShellFile).toHaveBeenCalledWith(expect.objectContaining({ auth: null }));
  });

  it('keeps the current auth when the patch omits the field', async () => {
    await updatePlatformShell(
      'my-portal',
      {
        name: 'Renamed',
        entry: current.entry,
        surface: current.surface,
        enabled: current.enabled,
        entryMode: 'shell',
      },
      { userId: 1, username: 'admin' },
    );

    expect(writeShellFile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Renamed',
      auth: current.auth,
    }));
  });
});
