import { describe, expect, it, vi } from 'vitest';

const getDesignerDraft = vi.fn();
const listDesignerDrafts = vi.fn();
vi.mock('../../../domain/component-designer/draftIo', () => ({
  getDesignerDraft: (...args: Parameters<typeof getDesignerDraft>) => getDesignerDraft(...args),
  listDesignerDrafts: () => listDesignerDrafts(),
}));

const collectDesignerResiduePageKeys = vi.fn();
vi.mock('../designerDeleteCleanup', () => ({
  collectDesignerResiduePageKeys: (...args: Parameters<typeof collectDesignerResiduePageKeys>) => collectDesignerResiduePageKeys(...args),
}));

const listPageModuleFiles = vi.fn();
const listRouteBindingFiles = vi.fn();
vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listPageModuleFiles: () => listPageModuleFiles(),
  listRouteBindingFiles: () => listRouteBindingFiles(),
}));

const lookupComponentUsageLastHits = vi.fn();
vi.mock('../../component-usage/componentUsagePersistence.service', () => ({
  lookupComponentUsageLastHits: (...args: Parameters<typeof lookupComponentUsageLastHits>) => (
    lookupComponentUsageLastHits(...args)
  ),
}));

import { computeDesignerComponentUsage, listUnusedDesignerComponents } from '../designerComponentUsage.service';

describe('computeDesignerComponentUsage', () => {
  it('throws a 404 HttpError when the draft does not exist', () => {
    getDesignerDraft.mockReturnValue(null);
    expect(() => computeDesignerComponentUsage('missing-draft')).toThrow('Version not found.');
  });

  it('returns only the pages whose pageKey resolves to this draft', () => {
    getDesignerDraft.mockReturnValue({ id: 'draft-1', name: 'hero-section' });
    collectDesignerResiduePageKeys.mockReturnValue(['hero-section']);
    listPageModuleFiles.mockReturnValue([
      { pageKey: 'hero-section', title: 'Hero Section', loaderKind: 'designer', ownerPackageId: null },
      { pageKey: 'unrelated-page', title: 'Unrelated', loaderKind: 'designer', ownerPackageId: null },
    ]);
    listRouteBindingFiles.mockReturnValue([
      { pageKey: 'hero-section', mountId: 'us' },
      { pageKey: 'hero-section', mountId: 'studio' },
      { pageKey: 'unrelated-page', mountId: 'us' },
    ]);

    const usage = computeDesignerComponentUsage('draft-1');

    expect(usage.pages).toHaveLength(1);
    expect(usage.pages[0]).toEqual({
      pageKey: 'hero-section',
      title: 'Hero Section',
      loaderKind: 'designer',
      ownerPackageId: null,
      mounts: ['us', 'studio'],
      loaderKindInvariantWarning: false,
    });
  });

  it('flags the loaderKind invariant when ownerPackageId is set but loaderKind is still core', () => {
    getDesignerDraft.mockReturnValue({ id: 'draft-2', name: 'legacy-widget' });
    collectDesignerResiduePageKeys.mockReturnValue(['legacy-widget']);
    listPageModuleFiles.mockReturnValue([
      { pageKey: 'legacy-widget', title: 'Legacy Widget', loaderKind: 'core', ownerPackageId: 'pkg-crm' },
    ]);
    listRouteBindingFiles.mockReturnValue([]);

    const usage = computeDesignerComponentUsage('draft-2');

    expect(usage.pages[0].loaderKindInvariantWarning).toBe(true);
    expect(usage.pages[0].mounts).toEqual([]);
  });

  it('returns an empty workflows array (no registry-discoverable workflow link exists)', () => {
    getDesignerDraft.mockReturnValue({ id: 'draft-3', name: 'orphan' });
    collectDesignerResiduePageKeys.mockReturnValue([]);
    listPageModuleFiles.mockReturnValue([]);
    listRouteBindingFiles.mockReturnValue([]);

    const usage = computeDesignerComponentUsage('draft-3');

    expect(usage.pages).toEqual([]);
    expect(usage.workflows).toEqual([]);
  });
});

describe('listUnusedDesignerComponents', () => {
  it('returns drafts with no matching page module, sorted by name', async () => {
    lookupComponentUsageLastHits.mockResolvedValue(new Map([
      ['alpha-orphan', '2026-01-10T12:00:00.000Z'],
    ]));
    listDesignerDrafts.mockReturnValue([
      { id: 'draft-used', name: 'zulu-used' },
      { id: 'draft-unused-a', name: 'alpha-orphan' },
      { id: 'draft-unused-b', name: 'bravo-orphan' },
    ]);
    collectDesignerResiduePageKeys.mockImplementation(({ draftId }: { draftId: string }) => {
      if (draftId === 'draft-used') {
        return ['zulu-used'];
      }
      return [];
    });
    listPageModuleFiles.mockReturnValue([
      { pageKey: 'zulu-used', title: 'Zulu', loaderKind: 'designer', ownerPackageId: null },
    ]);

    const unused = await listUnusedDesignerComponents();

    expect(unused).toEqual([
      { draftId: 'draft-unused-a', name: 'alpha-orphan', lastHitAt: '2026-01-10T12:00:00.000Z' },
      { draftId: 'draft-unused-b', name: 'bravo-orphan', lastHitAt: null },
    ]);
  });
});
