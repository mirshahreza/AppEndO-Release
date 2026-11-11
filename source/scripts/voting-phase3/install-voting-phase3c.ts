/**
 * Voting package — Phase 3c (Voting scope deep editor: questions + choices).
 *
 *   npm run voting:phase3c
 *   npm run voting:phase3c:rollback
 */

import { saveDesignerDraft, deleteDesignerDraft } from '../../src/server/services/component-designer/draftCoordinator.service';
import { publishDesignerComponent } from '../../src/server/services/component-designer/publishCoordinator.service';
import { pinDesignerPublishedLoaderRef } from '../../src/server/services/platform/designerRoutePropagation.service';
import { resolveExperienceManifestPageKey } from '../../src/features/component-designer/lib/designerDraftPath';
import {
  deletePlatformPageModule,
  findPlatformPageModuleByKey,
  listPlatformRouteBindingRows,
  deletePlatformRouteBinding,
} from '../../src/server/domain/platform';
import { PlatformCrudService } from '../../src/server/services/platform/platformCrud.service';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import type { ActorContext } from '../../src/server/types/requestContext';
import { buildVotingVotingsEditorDraft } from './votingVotingsEditorScaffold';
import { resolveVotingFilterOptions, resolveVotingIds } from './votingIds';
import { VOTING_ROUTE_PREFIX } from './votingStudioNav';
import type { VotingDesignerDraftBundle } from './votingDesignerScaffold';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'voting-phase3c';

const EDITOR_PAGE_NAME = 'voting-votings-editor';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeEditorRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (row.routePattern !== `${VOTING_ROUTE_PREFIX}/votings/edit/*`) continue;
    await deletePlatformRouteBinding(row.id);
    removed += 1;
  }
  return removed;
};

const publishBundle = async (bundle: VotingDesignerDraftBundle, title: string): Promise<PublishedPage> => {
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
    actor: ACTOR_LABEL,
  });
  const published = publishDesignerComponent(saved.id, ACTOR_LABEL);
  const loaderRef = published.loaderRef ?? `${bundle.folder}/${bundle.name}@v${published.publishedVersion}`;
  const pinOnce = () => pinDesignerPublishedLoaderRef({
    componentPath: `${bundle.folder}/${bundle.name}`,
    loaderRef,
    title,
    actor: { userId: null, username: ACTOR_LABEL },
  });
  const { pageKey } = await pinOnce().catch(() => pinOnce());
  console.log(`  published ${bundle.folder}/${bundle.name} → pageKey=${pageKey} loaderRef=${loaderRef} v${published.publishedVersion}`);
  return { draftId: saved.id, pageKey, loaderRef, folder: bundle.folder, name: bundle.name };
};

const install = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[Voting 3c] Resolving Base Info ids…');
  const ids = await resolveVotingIds();
  const filterOptions = await resolveVotingFilterOptions(ids);

  const editor = await publishBundle(buildVotingVotingsEditorDraft({ filterOptions }), 'Voting scope editor');

  const cleared = await removeEditorRouteBindings();
  if (cleared > 0) console.log(`  removed ${cleared} stale route bindings`);

  const platform = new PlatformCrudService();
  const editorBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${VOTING_ROUTE_PREFIX}/votings/edit/*`,
    pageKey: editor.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
  });
  console.log(`  route binding created: ${VOTING_ROUTE_PREFIX}/votings/edit/* → ${editor.pageKey} (#${editorBinding.body.id})`);

  console.log('[Voting 3c] Done.');
  console.log('  Open: /{culture}/studio/voting/votings/edit/{id}');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  await removeEditorRouteBindings();

  const componentPath = `voting/${EDITOR_PAGE_NAME}`;
  const pageKey = resolveExperienceManifestPageKey(componentPath);
  if (pageKey) {
    const existing = await findPlatformPageModuleByKey(pageKey);
    if (existing && existing.loaderRef?.startsWith(`${componentPath}@`)) {
      await deletePlatformPageModule(pageKey);
    }
  }

  deleteDesignerDraft(`draft-${EDITOR_PAGE_NAME}`);
  console.log('[Voting 3c rollback] Done.');
};

const main = async () => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error) => {
    console.error('[Voting 3c]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
