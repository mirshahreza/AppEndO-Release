import { describe, expect, it, vi } from 'vitest';
import { HAWIETY_PACKAGE_ID } from '../../../../core/packages/hawietyPackage';
import {
  filterHawietyHostRowsUnlessInstalled,
  filterHawietyNavigationsUnlessInstalled,
  isHawietyHostPlatformRow,
  isHawietyRuntimeEnabled,
} from '../hawietyRuntime';

vi.mock('../../../domain/package-domain/installStateRepository', () => ({
  isPluginRuntimeEnabled: vi.fn(),
}));

import { isPluginRuntimeEnabled } from '../../../domain/package-domain/installStateRepository';

describe('hawietyRuntime', () => {
  it('detects Hawiety host rows', () => {
    expect(isHawietyHostPlatformRow({ pageKey: 'hwy-members-all' })).toBe(true);
    expect(isHawietyHostPlatformRow({ loaderRef: 'core:HwyEtlConsole' })).toBe(true);
    expect(isHawietyHostPlatformRow({ routePattern: 'hawiety/members-all' })).toBe(true);
    expect(isHawietyHostPlatformRow({ id: 'hawiety' })).toBe(true);
    expect(isHawietyHostPlatformRow({ pageKey: 'users' })).toBe(false);
  });

  it('filters host rows when package is not installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    expect(isHawietyRuntimeEnabled()).toBe(false);
    const rows = [
      { pageKey: 'users' },
      { pageKey: 'hwy-etl-console' },
      { routePattern: 'hawiety/etl-console' },
    ];
    expect(filterHawietyHostRowsUnlessInstalled(rows)).toEqual([{ pageKey: 'users' }]);
  });

  it('passes rows through when package is installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockImplementation((id) => id === HAWIETY_PACKAGE_ID);
    const rows = [{ pageKey: 'hwy-etl-console' }];
    expect(filterHawietyHostRowsUnlessInstalled(rows)).toEqual(rows);
  });

  it('removes hawiety navigation manifest when package is off', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    const navigations = [
      { id: 'studio', groups: [{ items: [{ pageKey: 'users' }] }] },
      { id: 'hawiety', portalSegment: 'hawiety', groups: [{ items: [{ pageKey: 'hwy-members-all' }] }] },
    ];
    const filtered = filterHawietyNavigationsUnlessInstalled(navigations);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('studio');
  });
});
