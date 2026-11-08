/**

 * Rebuild + republish CMS vocab pages from scaffold.

 * Resolves category ids from the live CMS Base Info root (not stale snapshot parentIds).

 */

import { saveDesignerDraft } from '../../src/server/services/component-designer/draftCoordinator.service';

import { publishDesignerComponent } from '../../src/server/services/component-designer/publishCoordinator.service';

import { pinDesignerPublishedLoaderRef } from '../../src/server/services/platform/designerRoutePropagation.service';

import { closePrismaControlPlane, isPrismaControlPlaneReady } from '../../src/server/db/prismaControlPlane';

import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';

import { buildCmsVocabularyPage } from './cmsDesignerScaffold';

import { resolveCmsIds, type CmsResolvedIds } from './cmsIds';



const ACTOR = 'cms-phase3';



const VOCAB_SPECS = [

  {

    pageName: 'cms-vocab-content-tags',

    title: 'Content Tags',

    settingsSectionId: 'content-tags' as const,

    categoryKey: 'Content Tags' as const,

  },

  {

    pageName: 'cms-vocab-content-types',

    title: 'Content Types',

    settingsSectionId: 'content-types' as const,

    categoryKey: 'Content Types' as const,

  },

  {

    pageName: 'cms-vocab-statuses',

    title: 'Statuses',

    settingsSectionId: 'statuses' as const,

    categoryKey: 'Statuses' as const,

  },

  {

    pageName: 'cms-vocab-languages',

    title: 'Languages',

    settingsSectionId: 'languages' as const,

    categoryKey: 'Languages' as const,

  },

] as const;



const resolveCategoryId = (

  ids: CmsResolvedIds,

  categoryKey: (typeof VOCAB_SPECS)[number]['categoryKey'],

): string => {

  const categoryId = ids.categoryIds[categoryKey];

  if (!categoryId) {

    throw new Error(`CMS category "${categoryKey}" not found under root ${ids.rootId}.`);

  }

  return categoryId;

};



/** Republish CMS Settings vocab pages with live Base Info category parentIds. */
export const rebuildCmsVocabularyPages = async (): Promise<void> => {
  if (!isPrismaControlPlaneReady()) {
    resetControlPlaneInitState();
    await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  }

  const ids = await resolveCmsIds();

  console.log(`[rebuild-cms-vocab] cmsRoot=${ids.rootId}`);

  for (const spec of VOCAB_SPECS) {

    const categoryId = resolveCategoryId(ids, spec.categoryKey);

    const bundle = buildCmsVocabularyPage({

      pageName: spec.pageName,

      title: spec.title,

      categoryId,

      settingsSectionId: spec.settingsSectionId,

    });

    const draftId = `draft-${bundle.name}`;

    const saved = saveDesignerDraft({

      id: draftId,

      name: bundle.name,

      folder: bundle.folder,

      document: { ...bundle.document, id: draftId, name: bundle.name },

      bindingDefinitions: bundle.bindingDefinitions as unknown as Record<

        string,

        import('../../src/domain/component-designer/types').DesignerBindingDefinition

      >,

      actor: ACTOR,

    });

    const published = publishDesignerComponent(saved.id, ACTOR);

    const loaderRef = published.loaderRef

      ?? `${saved.folder}/${saved.name}@v${published.publishedVersion}`;

    const pinOnce = () => pinDesignerPublishedLoaderRef({

      componentPath: `${saved.folder}/${saved.name}`,

      loaderRef,

      title: spec.title,

      actor: { userId: null, username: ACTOR },

    });

    await pinOnce().catch(() => pinOnce());

    console.log(`  rebuilt+published ${draftId} → ${loaderRef} (parentId=${categoryId})`);
  }
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('rebuild-cms-vocab.ts');

if (isMain) {
  rebuildCmsVocabularyPages()
    .catch((error: unknown) => {
      console.error('[rebuild-cms-vocab]', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePrismaControlPlane().catch(() => undefined);
    });
}

