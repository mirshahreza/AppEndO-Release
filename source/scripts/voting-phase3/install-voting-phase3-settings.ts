/**
 * Voting package — Phase 3 settings (Settings shell + vocabulary pages + Studio nav group).
 *
 *   npm run voting:phase3-settings
 *   npm run voting:phase3-settings:rollback
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
import {
  buildVotingSettingsDraft,
  buildVotingVocabularyPage,
  type VotingDesignerDraftBundle,
  type VotingSettingsSectionId,
} from './votingDesignerScaffold';
import { resolveVotingIds, type VotingResolvedIds } from './votingIds';
import {
  buildVotingStudioNavGroup,
  removeVotingStudioNavGroup,
  upsertVotingStudioNavGroup,
  VOTING_ROUTE_PREFIX,
  type VotingStudioNavPage,
} from './votingStudioNav';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'voting-phase3-settings';

type VocabSpec = {
  slug: string;
  title: string;
  categoryKey: keyof VotingResolvedIds['categoryIds'];
  pageName: string;
  settingsSectionId: VotingSettingsSectionId;
};

const VOCAB_SPECS: VocabSpec[] = [
  {
    slug: 'voting-statuses',
    title: 'Voting statuses',
    categoryKey: 'Voting statuses',
    pageName: 'voting-vocab-voting-statuses',
    settingsSectionId: 'voting-statuses',
  },
  {
    slug: 'ballot-types',
    title: 'Ballot types',
    categoryKey: 'Ballot types',
    pageName: 'voting-vocab-ballot-types',
    settingsSectionId: 'ballot-types',
  },
  {
    slug: 'registration-statuses',
    title: 'Registration statuses',
    categoryKey: 'Registration statuses',
    pageName: 'voting-vocab-registration-statuses',
    settingsSectionId: 'registration-statuses',
  },
  {
    slug: 'observer-roles',
    title: 'Observer roles',
    categoryKey: 'Observer roles',
    pageName: 'voting-vocab-observer-roles',
    settingsSectionId: 'observer-roles',
  },
  {
    slug: 'cast-channels',
    title: 'Cast channels',
    categoryKey: 'Cast channels',
    pageName: 'voting-vocab-cast-channels',
    settingsSectionId: 'cast-channels',
  },
];

const SETTINGS_PAGE_NAME = 'voting-settings';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeVotingSettingsRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (!row.routePattern.startsWith(`${VOTING_ROUTE_PREFIX}/settings`)) continue;
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

  console.log('[Voting Phase 3 settings] Resolving Base Info ids from Phase 1…');
  const ids = await resolveVotingIds();

  console.log('[Voting Phase 3 settings] Publishing Client Components (Settings + vocab pages)…');
  const publishedPages: PublishedPage[] = [];

  const settings = await publishBundle(
    buildVotingSettingsDraft({ categoryId: ids.categoryIds['Voting statuses'] }),
    'Voting Settings',
  );
  publishedPages.push(settings);

  const vocabPages: Array<PublishedPage & { spec: VocabSpec }> = [];
  for (const spec of VOCAB_SPECS) {
    const published = await publishBundle(
      buildVotingVocabularyPage({
        pageName: spec.pageName,
        title: spec.title,
        categoryId: ids.categoryIds[spec.categoryKey],
        settingsSectionId: spec.settingsSectionId,
      }),
      spec.title,
    );
    publishedPages.push(published);
    vocabPages.push({ ...published, spec });
  }

  console.log('[Voting Phase 3 settings] Clearing stale voting/settings route bindings…');
  const clearedBefore = await removeVotingSettingsRouteBindings();
  if (clearedBefore > 0) console.log(`  removed ${clearedBefore} stale route bindings`);

  console.log('[Voting Phase 3 settings] Registering route bindings…');
  const platform = new PlatformCrudService();

  type RouteSpec = {
    routePattern: string;
    pageKey: string;
    nav: null | {
      label: string;
      icon: string;
      group: string;
      order: number;
      description: string;
      color: string;
      separatorBefore?: boolean;
    };
  };

  const routeSpecs: RouteSpec[] = [
    {
      routePattern: `${VOTING_ROUTE_PREFIX}/settings/*`,
      pageKey: settings.pageKey,
      nav: {
        label: 'Settings',
        icon: 'Settings',
        group: 'Voting',
        order: 2,
        description: 'Voting Base Info vocabularies.',
        color: 'text-slate-600',
        separatorBefore: true,
      },
    },
    ...vocabPages.map((page) => ({
      routePattern: `${VOTING_ROUTE_PREFIX}/settings/${page.spec.slug}`,
      pageKey: page.pageKey,
      nav: null,
    })),
  ];

  for (const spec of routeSpecs) {
    const created = await platform.createRouteBinding(ACTOR, {
      mountId: 'studio',
      routePattern: spec.routePattern,
      pageKey: spec.pageKey,
      enabled: true,
      auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
      nav: spec.nav,
    });
    console.log(`  route binding created: ${spec.routePattern} → ${spec.pageKey} (#${created.body.id})`);
  }

  const existingStub = await findPlatformPageModuleByKey('voting-settings');
  if (existingStub?.loaderRef?.startsWith('voting:voting-settings')) {
    await deletePlatformPageModule('voting-settings');
    console.log('  removed package stub page-module: voting-settings');
  }

  console.log('[Voting Phase 3 settings] Upserting Studio nav group (Settings; Elections ships in 3b)…');
  const navPages: VotingStudioNavPage[] = [
    {
      pageKey: settings.pageKey,
      routePattern: `${VOTING_ROUTE_PREFIX}/settings/*`,
      label: 'Settings',
      icon: 'Settings',
      description: 'Voting Base Info vocabularies.',
      iconColor: 'text-slate-600',
      order: 2,
      separatorBefore: true,
    },
  ];
  upsertVotingStudioNavGroup(buildVotingStudioNavGroup(navPages));

  console.log('[Voting Phase 3 settings] Done.');
  console.log(`  Pages published: ${publishedPages.length}`);
  console.log('  Open: /{culture}/studio/voting/settings');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[Voting Phase 3 settings rollback] Removing voting/settings route bindings…');
  const removedRoutes = await removeVotingSettingsRouteBindings();
  console.log(`  route bindings removed: ${removedRoutes}`);

  removeVotingStudioNavGroup();

  const allPageKeys = [SETTINGS_PAGE_NAME, ...VOCAB_SPECS.map((spec) => spec.pageName)];
  for (const bundleName of allPageKeys) {
    const componentPath = `voting/${bundleName}`;
    const pageKey = resolveExperienceManifestPageKey(componentPath);
    if (!pageKey) continue;
    const existing = await findPlatformPageModuleByKey(pageKey);
    if (existing && existing.loaderRef?.startsWith(`${componentPath}@`)) {
      await deletePlatformPageModule(pageKey);
      console.log(`  page-module removed: ${pageKey}`);
    }
  }

  for (const name of allPageKeys) {
    deleteDesignerDraft(`draft-${name}`);
  }

  console.log('[Voting Phase 3 settings rollback] Done.');
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
    console.error('[Voting Phase 3 settings]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
