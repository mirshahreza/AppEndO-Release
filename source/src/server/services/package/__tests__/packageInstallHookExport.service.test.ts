import { describe, it, expect } from 'vitest';
import { buildPackageInstallHookExportEntry } from '../packageInstallHookExport.service';

describe('packageInstallHookExport.service', () => {
  it('wraps hook source into a capability entry + zip entry at hooks/<id>.ts', () => {
    const result = buildPackageInstallHookExportEntry({
      id: 'cms-base-info-seed',
      source: 'export default async function seed(api) { await api.baseInfo.insertNode({ title: "CMS" }); }',
      timeoutMs: 30000,
    });

    expect(result.capability).toEqual({
      id: 'cms-base-info-seed',
      entry: 'hooks/cms-base-info-seed.ts',
      timeoutMs: 30000,
    });
    expect(result.zipEntry.path).toBe('hooks/cms-base-info-seed.ts');
    expect(result.zipEntry.content.toString('utf8')).toContain('CMS');
  });

  it('omits timeoutMs from the capability when not provided', () => {
    const result = buildPackageInstallHookExportEntry({ id: 'hook-one', source: 'export default async function () {}' });
    expect(result.capability.timeoutMs).toBeUndefined();
  });
});
