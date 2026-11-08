import { rebuildCmsVocabularyPages } from '../../../../scripts/cms-phase3/rebuild-cms-vocab';

/**
 * Rebind CMS Settings vocab grids to the current Base Info category ids (fixes stale
 * parentId in published designer pages after CMS root HID changes).
 */
export async function republishCmsVocabularyPages(): Promise<void> {
  await rebuildCmsVocabularyPages();
}
