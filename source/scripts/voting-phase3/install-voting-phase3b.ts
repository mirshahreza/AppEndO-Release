/**
 * Voting package — Phase 3b (Voting scopes catalog list/grid).
 *
 *   npm run voting:phase3b
 *   npm run voting:phase3b:rollback
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
import { readNavigationFile } from '../../src/core/platform-registry/PlatformRegistryFileStore';
import { buildVotingVotingsListDraft } from './votingVotingsScaffold';
import { resolveVotingFilterOptions, resolveVotingIds } from './votingIds';
import {
  buildVotingStudioNavGroup,
  upsertVotingStudioNavGroup,
  VOTING_ROUTE_PREFIX,
  VOTING_STUDIO_GROUP_HEADING,
  type VotingStudioNavPage,
} from './votingStudioNav';
import type { VotingDesignerDraftBundle } from './votingDesignerScaffold';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'voting-phase3b';

const LIST_PAGE_NAME = 'voting-votings';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeVotingVotingsRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (row.routePattern !== `${VOTING_ROUTE_PREFIX}/votings` && row.routePattern !== `${VOTING_ROUTE_PREFIX}/elections`) continue;
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

  console.log('[Voting 3b] Resolving Base Info ids…');
  const ids = await resolveVotingIds();
  const filterOptions = await resolveVotingFilterOptions(ids);

  for (const legacyPageKey of ['voting-elections', 'voting-votings']) {
    const existing = await findPlatformPageModuleByKey(legacyPageKey);
    if (!existing) continue;
    if (existing.loaderRef?.startsWith(`voting:${legacyPageKey}`) || legacyPageKey === 'voting-elections') {
      await deletePlatformPageModule(legacyPageKey);
      console.log(`  removed page-module: ${legacyPageKey}`);
    }
  }

  console.log('[Voting 3b] Publishing Voting scopes catalog…');
  const list = await publishBundle(buildVotingVotingsListDraft({ filterOptions }), 'Voting');

  const cleared = await removeVotingVotingsRouteBindings();
  if (cleared > 0) console.log(`  removed ${cleared} stale route bindings`);

  const platform = new PlatformCrudService();
  const listNav = {
    label: 'Voting',
    icon: 'Vote',
    group: 'Voting',
    order: 1,
    description: 'Voting scopes, ballots, and operations.',
    color: 'text-violet-600',
  };

  const listBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${VOTING_ROUTE_PREFIX}/votings`,
    pageKey: list.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    nav: listNav,
  });
  console.log(`  route binding created: ${VOTING_ROUTE_PREFIX}/votings → ${list.pageKey} (#${listBinding.body.id})`);

  console.log('[Voting 3b] Merging Voting into Studio nav group…');
  const nav = readNavigationFile('studio');
  const existingGroup = (nav?.groups ?? []).find((g) => g.heading === VOTING_STUDIO_GROUP_HEADING);
  const existingItems = (existingGroup?.items ?? []).filter((item) => item.pageKey !== list.pageKey);
  const votingNavPage: VotingStudioNavPage = {
    pageKey: list.pageKey,
    routePattern: `${VOTING_ROUTE_PREFIX}/votings`,
    label: listNav.label,
    icon: listNav.icon,
    description: listNav.description,
    iconColor: listNav.color,
    order: listNav.order,
  };
  const navPages: VotingStudioNavPage[] = [
    votingNavPage,
    ...existingItems.map((item) => ({
      pageKey: item.pageKey,
      routePattern: item.routePattern,
      label: item.label,
      icon: item.icon,
      description: item.description ?? '',
      iconColor: item.iconColor ?? 'text-slate-600',
      order: item.order ?? 99,
      separatorBefore: item.separatorBefore,
    })),
  ].sort((a, b) => a.order - b.order);
  upsertVotingStudioNavGroup(buildVotingStudioNavGroup(navPages));

  console.log('[Voting 3b] Done.');
  console.log('  Open: /{culture}/studio/voting/votings');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  await removeVotingVotingsRouteBindings();

  const nav = readNavigationFile('studio');
  const group = (nav?.groups ?? []).find((g) => g.heading === VOTING_STUDIO_GROUP_HEADING);
  if (group) {
    const pageKey = resolveExperienceManifestPageKey(`voting/${LIST_PAGE_NAME}`);
    const remainingItems = group.items.filter((item) => item.pageKey !== pageKey);
    const navPages: VotingStudioNavPage[] = remainingItems.map((item) => ({
      pageKey: item.pageKey,
      routePattern: item.routePattern,
      label: item.label,
      icon: item.icon,
      description: item.description ?? '',
      iconColor: item.iconColor ?? 'text-slate-600',
      order: item.order ?? 99,
      separatorBefore: item.separatorBefore,
    }));
    upsertVotingStudioNavGroup(buildVotingStudioNavGroup(navPages));
  }

  const componentPath = `voting/${LIST_PAGE_NAME}`;
  const pageKey = resolveExperienceManifestPageKey(componentPath);
  if (pageKey) {
    const existing = await findPlatformPageModuleByKey(pageKey);
    if (existing && existing.loaderRef?.startsWith(`${componentPath}@`)) {
      await deletePlatformPageModule(pageKey);
    }
  }

  deleteDesignerDraft(`draft-${LIST_PAGE_NAME}`);
  console.log('[Voting 3b rollback] Done.');
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
    console.error('[Voting 3b]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
