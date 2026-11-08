/**
 * Republish only the CMS Contents list draft (after scaffold row-action changes).
 * Usage: npx tsx scripts/cms-phase3/republish-contents-list.ts
 */
import { saveDesignerDraft } from '../../src/server/services/component-designer/draftCoordinator.service';
import { publishDesignerComponent } from '../../src/server/services/component-designer/publishCoordinator.service';
import { pinDesignerPublishedLoaderRef } from '../../src/server/services/platform/designerRoutePropagation.service';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { buildCmsContentsListDraft } from './cmsDesignerScaffold';
import { resolveCmsFilterOptions, resolveCmsIds } from './cmsIds';

const ACTOR_LABEL = 'cms-phase3';

const main = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const ids = await resolveCmsIds();
  const filterOptions = await resolveCmsFilterOptions();
  const bundle = buildCmsContentsListDraft({
    statusIds: { archived: ids.statusIds.archived, draft: ids.statusIds.draft },
    filterOptions,
    baseInfoCategoryIds: ids.categoryIds,
  });

  const draftId = `draft-${bundle.name}`;
  console.log(`[CMS] Saving ${draftId}…`);
  const saved = saveDesignerDraft({
    id: draftId,
    name: bundle.name,
    folder: bundle.folder,
    document: { ...bundle.document, id: draftId, name: bundle.name },
    bindingDefinitions: bundle.bindingDefinitions as unknown as Record<
      string,
      import('../../src/domain/component-designer/types').DesignerBindingDefinition
    >,
    actor: ACTOR_LABEL,
  });

  console.log('[CMS] Publishing…');
  const published = publishDesignerComponent(saved.id, ACTOR_LABEL);
  const loaderRef = published.loaderRef ?? `${bundle.folder}/${bundle.name}@v${published.publishedVersion}`;
  const pinOnce = () => pinDesignerPublishedLoaderRef({
    componentPath: `${bundle.folder}/${bundle.name}`,
    loaderRef,
    title: 'Contents',
    actor: { userId: null, username: ACTOR_LABEL },
  });
  const { pageKey } = await pinOnce().catch(() => pinOnce());
  console.log(`[CMS] Done → pageKey=${pageKey} loaderRef=${loaderRef} v${published.publishedVersion}`);

  await closePrismaControlPlane();
};

main().catch(async (error) => {
  console.error(error);
  await closePrismaControlPlane().catch(() => undefined);
  process.exitCode = 1;
});
