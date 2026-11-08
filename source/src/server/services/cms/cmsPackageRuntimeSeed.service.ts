import { ensureCmsPackageRuntimeSeed } from '../../domain/cms-package-seed/seedCmsRuntimeData';
import { invalidateBaseInfoOptionsCache } from '../baseInfoOptionsCache';
import { republishCmsVocabularyPages } from './republishCmsDesignerPages.service';

const CMS_PACKAGE_ID = 'cms';

export function isCmsPackageId(packageId: string): boolean {
  return packageId.trim().toLowerCase() === CMS_PACKAGE_ID;
}

/**
 * After CMS package DB scripts, guarantee Base Info vocab, cms_settings, and sample
 * editorial rows exist. Idempotent — repairs empty installs when optional ZIP seed
 * was skipped or capture had no live rows.
 */
export async function runCmsPackageRuntimeSeedAfterInstall(packageId: string): Promise<void> {
  if (!isCmsPackageId(packageId)) {
    return;
  }
  await ensureCmsPackageRuntimeSeed();
  invalidateBaseInfoOptionsCache();
  await republishCmsVocabularyPages();
}
