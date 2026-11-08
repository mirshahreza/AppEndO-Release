import { describe, expect, it } from 'vitest';
import { mergeCultureTranslationBundles } from '../../platform/platformCultureTranslationsSeed';
import { overlayPackageCultureKeysOnBundles } from '../packageCultureKeysSidecar';

describe('overlayPackageCultureKeysOnBundles', () => {
  it('overwrites stale hub labels in the English master bundle only', () => {
    const next = overlayPackageCultureKeysOnBundles(
      {
        us: { 'nav.file-hub': 'File Hub', 'nav.users': 'Users' },
        ir: { 'nav.file-hub': 'File Hub', 'nav.users': 'Users' },
      },
      { 'nav.file-hub': 'Sftp', 'nav.ssh-hub': 'SSH' },
    );
    expect(next.us).toEqual({
      'nav.file-hub': 'Sftp',
      'nav.users': 'Users',
      'nav.ssh-hub': 'SSH',
    });
    expect(next.ir?.['nav.file-hub']).toBe('File Hub');
    expect(next.ir?.['nav.ssh-hub']).toBeUndefined();
  });

  it('refreshes shipped locale packs from seed over stored bundles', () => {
    const merged = mergeCultureTranslationBundles(
      { us: { 'nav.file-hub': 'File Hub' } },
      { us: { 'nav.file-hub': 'Sftp' } },
    );
    expect(merged.us?.['nav.file-hub']).toBe('Sftp');
    const next = overlayPackageCultureKeysOnBundles(merged, { 'nav.file-hub': 'Sftp' });
    expect(next.us?.['nav.file-hub']).toBe('Sftp');
  });

  it('refreshes logs and retention copy from seed over stored bundles', () => {
    const merged = mergeCultureTranslationBundles(
      {
        us: {
          'operations.retention.dryRun': 'Discard',
          'nav.users': 'People',
        },
      },
      {
        us: {
          'operations.retention.dryRun': 'Dry-run',
          'nav.users': 'Users',
        },
      },
    );
    expect(merged.us?.['operations.retention.dryRun']).toBe('Dry-run');
    expect(merged.us?.['nav.users']).toBe('Users');
  });
});
