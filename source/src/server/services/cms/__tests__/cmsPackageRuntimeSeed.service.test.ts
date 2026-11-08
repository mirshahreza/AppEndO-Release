import { describe, expect, it, vi } from 'vitest';
import { isCmsPackageId, runCmsPackageRuntimeSeedAfterInstall } from '../cmsPackageRuntimeSeed.service';

vi.mock('../../../domain/cms-package-seed/seedCmsRuntimeData', () => ({
  ensureCmsPackageRuntimeSeed: vi.fn(async () => undefined),
}));

vi.mock('../../baseInfoOptionsCache', () => ({
  invalidateBaseInfoOptionsCache: vi.fn(),
}));

vi.mock('../republishCmsDesignerPages.service', () => ({
  republishCmsVocabularyPages: vi.fn(async () => undefined),
}));

describe('cmsPackageRuntimeSeed.service', () => {
  it('recognizes the cms package id', () => {
    expect(isCmsPackageId('cms')).toBe(true);
    expect(isCmsPackageId('CMS')).toBe(true);
    expect(isCmsPackageId('crm')).toBe(false);
  });

  it('runs foundation seed only for the cms package', async () => {
    const { ensureCmsPackageRuntimeSeed } = await import('../../../domain/cms-package-seed/seedCmsRuntimeData');
    await runCmsPackageRuntimeSeedAfterInstall('crm');
    expect(ensureCmsPackageRuntimeSeed).not.toHaveBeenCalled();

    const { republishCmsVocabularyPages } = await import('../republishCmsDesignerPages.service');
    await runCmsPackageRuntimeSeedAfterInstall('cms');
    expect(ensureCmsPackageRuntimeSeed).toHaveBeenCalledTimes(1);
    expect(republishCmsVocabularyPages).toHaveBeenCalledTimes(1);
  });
});
