import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NavigationManifest } from '../../../../shared/api/contracts/platform/navigation';

vi.mock('../../../domain/platform', () => ({
  listPlatformShellRows: vi.fn(() => []),
}));

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listNavigationFiles: vi.fn(() => []),
  readNavigationFile: vi.fn(() => null),
  writeNavigationFile: vi.fn(),
  deleteNavigationFile: vi.fn(),
  listShellFiles: vi.fn(() => []),
  writeShellFile: vi.fn(),
}));

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(async () => undefined),
}));

import {
  readNavigationFile,
  writeNavigationFile,
  deleteNavigationFile,
  listShellFiles,
  writeShellFile,
} from '../../../../core/platform-registry/PlatformRegistryFileStore';
import {
  createNavigationManifest,
  deleteNavigationManifest,
  renameNavigationManifest,
  updateNavigationManifest,
} from '../navigationManifest.service';

const sampleManifest: NavigationManifest = {
  id: 'custom-nav',
  version: '1',
  groups: [
    {
      heading: 'Main',
      items: [{ label: 'Home', pageKey: 'dashboard', routePattern: '' }],
    },
  ],
};

describe('navigationManifest.service', () => {
  beforeEach(() => {
    vi.mocked(readNavigationFile).mockReturnValue(null);
    vi.mocked(listShellFiles).mockReturnValue([]);
    vi.mocked(writeNavigationFile).mockClear();
    vi.mocked(deleteNavigationFile).mockClear();
    vi.mocked(writeShellFile).mockClear();
  });

  it('rejects creating built-in navigation ids', async () => {
    const result = await createNavigationManifest({ ...sampleManifest, id: 'studio' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
    }
  });

  it('rejects creating navigation without portalSegment', async () => {
    const result = await createNavigationManifest(sampleManifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
    }
  });

  it('creates a custom navigation manifest', async () => {
    const result = await createNavigationManifest({
      ...sampleManifest,
      portalSegment: 'my-portal',
    });
    expect(result.ok).toBe(true);
    expect(writeNavigationFile).toHaveBeenCalledWith(expect.objectContaining({
      id: 'custom-nav',
      groups: expect.arrayContaining([
        expect.objectContaining({
          heading: 'Main',
          items: expect.arrayContaining([
            expect.objectContaining({ label: 'Home', pageKey: 'dashboard' }),
          ]),
        }),
      ]),
    }));
  });

  it('updates built-in navigation manifests', async () => {
    vi.mocked(readNavigationFile).mockReturnValue({ id: 'studio', version: '1', groups: [] });
    const result = await updateNavigationManifest('studio', {
      id: 'studio',
      version: '1',
      groups: [{
        heading: null,
        items: [{
          label: 'Users',
          pageKey: 'users',
          routePattern: 'users',
        }],
      }],
    });
    expect(result.ok).toBe(true);
    expect(writeNavigationFile).toHaveBeenCalled();
  });

  it('deletes navigation and clears shell navigationRef when referenced', async () => {
    vi.mocked(readNavigationFile).mockReturnValue(sampleManifest);
    vi.mocked(listShellFiles).mockReturnValue([
      {
        shellKey: 'my-portal',
        navigationRef: 'custom-nav',
      } as ReturnType<typeof listShellFiles>[number],
    ]);

    const result = await deleteNavigationManifest('custom-nav');
    expect(result.ok).toBe(true);
    expect(writeShellFile).toHaveBeenCalledWith(expect.objectContaining({
      shellKey: 'my-portal',
      navigationRef: null,
    }));
    expect(deleteNavigationFile).toHaveBeenCalledWith('custom-nav');
  });

  it('treats a missing navigation as already deleted', async () => {
    const result = await deleteNavigationManifest('site');
    expect(result.ok).toBe(true);
    expect(deleteNavigationFile).toHaveBeenCalledWith('site');
  });

  it('deletes navigation and reassigns shell navigationRef when replacement is provided', async () => {
    vi.mocked(readNavigationFile).mockImplementation((id) => {
      if (id === 'custom-nav' || id === 'other-nav') {
        return { ...sampleManifest, id };
      }
      return null;
    });
    vi.mocked(listShellFiles).mockReturnValue([
      {
        shellKey: 'my-portal',
        navigationRef: 'custom-nav',
      } as ReturnType<typeof listShellFiles>[number],
    ]);

    const result = await deleteNavigationManifest('custom-nav', {
      replacementNavigationRef: 'other-nav',
    });
    expect(result.ok).toBe(true);
    expect(writeShellFile).toHaveBeenCalledWith(expect.objectContaining({
      shellKey: 'my-portal',
      navigationRef: 'other-nav',
    }));
    expect(deleteNavigationFile).toHaveBeenCalledWith('custom-nav');
  });

  it('renames navigation and updates shell navigationRef', async () => {
    vi.mocked(readNavigationFile).mockImplementation((id) => {
      if (id === 'custom-nav') {
        return { ...sampleManifest, portalSegment: 'my-portal' };
      }
      return null;
    });
    vi.mocked(listShellFiles).mockReturnValue([
      {
        shellKey: 'my-portal',
        navigationRef: 'custom-nav',
      } as ReturnType<typeof listShellFiles>[number],
    ]);

    const result = await renameNavigationManifest('custom-nav', 'renamed-nav');
    expect(result.ok).toBe(true);
    expect(writeNavigationFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'renamed-nav' }));
    expect(writeShellFile).toHaveBeenCalledWith(expect.objectContaining({
      shellKey: 'my-portal',
      navigationRef: 'renamed-nav',
    }));
    expect(deleteNavigationFile).toHaveBeenCalledWith('custom-nav');
  });
});
