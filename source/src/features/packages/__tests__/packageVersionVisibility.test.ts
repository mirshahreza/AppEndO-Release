import { describe, expect, it } from 'vitest';
import type { PackageRow } from '../types';
import { filterPackageRowsByVersionVisibility } from '../utils';

const row = (
  partial: Pick<PackageRow, 'packageId' | 'version'> & Partial<PackageRow>,
): PackageRow => ({
  displayName: partial.packageId,
  installStatus: 'not_installed',
  activeInstalledVersion: null,
  runtimeEnabled: false,
  pluginKind: null,
  deploymentStatus: 'none',
  createdAt: null,
  createdBy: null,
  ...partial,
});

describe('filterPackageRowsByVersionVisibility', () => {
  it('hides non-latest catalog versions by default', () => {
    const rows = [
      row({ packageId: 'cms', version: '1.3.7', activeInstalledVersion: '1.3.7', installStatus: 'installed' }),
      row({ packageId: 'cms', version: '1.3.9', activeInstalledVersion: '1.3.7' }),
    ];

    const filtered = filterPackageRowsByVersionVisibility(rows, false);
    expect(filtered.map((item) => item.version)).toEqual(['1.3.9']);
  });

  it('shows every version when showOlderVersions is enabled', () => {
    const rows = [
      row({ packageId: 'cms', version: '1.3.7', activeInstalledVersion: '1.3.7', installStatus: 'installed' }),
      row({ packageId: 'cms', version: '1.3.9', activeInstalledVersion: '1.3.7' }),
    ];

    const filtered = filterPackageRowsByVersionVisibility(rows, true);
    expect(filtered.map((item) => item.version)).toEqual(['1.3.7', '1.3.9']);
  });
});
