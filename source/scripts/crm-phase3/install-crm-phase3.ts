/**
 * CRM domain — Phase 3a ONLY (Settings shell + 4 vocabulary pages + Studio nav group `CRM`).
 *
 * Deliberately narrow per plans/packages/todo/crm-package/p-packages-crm.md "ترتیب سخت ساخت":
 * Customers/Opportunities/Tickets pages do not exist yet — they ship in 3b/3c/3d, each adding
 * its own item to the CRM nav group on top of what this script already registered. Do not grow
 * this script to cover later sub-phases; each sub-phase gets its own install step.
 *
 * Opt-in only. Publishes designer components, registers route bindings on
 * `mountId: 'studio'` with `routePattern` prefixed `crm/…`, and adds an independent
 * `heading: "CRM"` group to `navigation/studio.json` — never a separate portal.
 *
 * Usage:
 *   npm run crm:phase3
 *   npm run crm:phase3:rollback
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
  buildCrmSettingsDraft,
  buildCrmVocabularyPage,
  type CrmDesignerDraftBundle,
  type CrmSettingsSectionId,
} from './crmDesignerScaffold';
import { resolveCrmIds, type CrmResolvedIds } from './crmIds';
import {
  buildCrmStudioNavGroup,
  CRM_ROUTE_PREFIX,
  removeCrmStudioNavGroup,
  upsertCrmStudioNavGroup,
  type CrmStudioNavPage,
} from './crmStudioNav';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'crm-phase3a';

type VocabSpec = {
  slug: string;
  title: string;
  categoryKey: keyof CrmResolvedIds['categoryIds'];
  pageName: string;
  settingsSectionId: CrmSettingsSectionId;
};

/** Manageable Base Info categories under CRM Settings left rail (not main menu). */
const VOCAB_SPECS: VocabSpec[] = [
  {
    slug: 'lead-sources',
    title: 'Lead Sources',
    categoryKey: 'Lead Sources',
    pageName: 'crm-vocab-lead-sources',
    settingsSectionId: 'lead-sources',
  },
  {
    slug: 'ticket-priority',
    title: 'Ticket Priority',
    categoryKey: 'Ticket Priority',
    pageName: 'crm-vocab-ticket-priority',
    settingsSectionId: 'ticket-priority',
  },
  {
    slug: 'ticket-channel',
    title: 'Ticket Channel',
    categoryKey: 'Ticket Channel',
    pageName: 'crm-vocab-ticket-channel',
    settingsSectionId: 'ticket-channel',
  },
  {
    slug: 'customer-tags',
    title: 'Customer Tags',
    categoryKey: 'Customer Tags',
    pageName: 'crm-vocab-customer-tags',
    settingsSectionId: 'customer-tags',
  },
];

const SETTINGS_PAGE_NAME = 'crm-settings';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeCrmRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (!row.routePattern.startsWith(`${CRM_ROUTE_PREFIX}/`)) continue;
    await deletePlatformRouteBinding(row.id);
    removed += 1;
  }
  return removed;
};

const publishBundle = async (bundle: CrmDesignerDraftBundle, title: string): Promise<PublishedPage> => {
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

  console.log('[CRM Phase 3a] Resolving Base Info ids from Phase 1…');
  const ids = await resolveCrmIds();

  console.log('[CRM Phase 3a] Publishing Client Components (Settings + 4 vocab pages)…');
  const publishedPages: PublishedPage[] = [];

  const settings = await publishBundle(
    buildCrmSettingsDraft({ categoryId: ids.categoryIds['Lead Sources'] }),
    'CRM Settings',
  );
  publishedPages.push(settings);

  const vocabPages: Array<PublishedPage & { spec: VocabSpec }> = [];
  for (const spec of VOCAB_SPECS) {
    const published = await publishBundle(
      buildCrmVocabularyPage({
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

  console.log('[CRM Phase 3a] Clearing any previous CRM route bindings (idempotent re-run)…');
  const clearedBefore = await removeCrmRouteBindings();
  if (clearedBefore > 0) console.log(`  removed ${clearedBefore} stale route bindings`);

  console.log('[CRM Phase 3a] Registering route bindings (mountId=studio, routePattern prefixed crm/…)…');
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
      routePattern: `${CRM_ROUTE_PREFIX}/settings/*`,
      pageKey: settings.pageKey,
      nav: {
        label: 'Settings',
        icon: 'Settings',
        group: 'CRM',
        order: 4,
        description: 'CRM Base Info vocabularies.',
        color: 'text-slate-600',
      },
    },
    ...vocabPages.map((page) => ({
      routePattern: `${CRM_ROUTE_PREFIX}/settings/${page.spec.slug}`,
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

  console.log('[CRM Phase 3a] Upserting Studio nav group heading=CRM (Settings only — 3b/3c/3d add their own items later)…');
  const navPages: CrmStudioNavPage[] = [
    {
      pageKey: settings.pageKey,
      routePattern: `${CRM_ROUTE_PREFIX}/settings/*`,
      label: 'Settings',
      icon: 'Settings',
      description: 'CRM Base Info vocabularies.',
      iconColor: 'text-slate-600',
      order: 4,
    },
  ];
  upsertCrmStudioNavGroup(buildCrmStudioNavGroup(navPages));

  console.log('[CRM Phase 3a] Done.');
  console.log('  Open: /{culture}/studio/crm/settings (e.g. /us/studio/crm/settings)');
  console.log(`  Pages published: ${publishedPages.length} (Client Components, loaderKind=designer)`);
  console.log('  Nav: Studio sidebar → group CRM (Settings only — Customers/Opportunities/Tickets ship in 3b/3c/3d)');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CRM Phase 3a rollback] Removing CRM route bindings…');
  const removedRoutes = await removeCrmRouteBindings();
  console.log(`  route bindings removed: ${removedRoutes}`);

  console.log('[CRM Phase 3a rollback] Removing Studio nav group CRM…');
  const removedNav = removeCrmStudioNavGroup();
  console.log(`  studio nav group CRM: ${removedNav ? 'removed' : 'already absent'}`);

  const allPageKeys = [SETTINGS_PAGE_NAME, ...VOCAB_SPECS.map((spec) => spec.pageName)];
  const allDraftIds = allPageKeys.map((name) => `draft-${name}`);

  console.log('[CRM Phase 3a rollback] Removing CRM page modules…');
  for (const bundleName of allPageKeys) {
    const componentPath = `crm/${bundleName}`;
    const pageKey = resolveExperienceManifestPageKey(componentPath);
    if (!pageKey) continue;
    const existing = await findPlatformPageModuleByKey(pageKey);
    if (existing && existing.loaderRef?.startsWith(`${componentPath}@`)) {
      await deletePlatformPageModule(pageKey);
      console.log(`  page-module removed: ${pageKey}`);
    } else if (existing) {
      console.log(`  page-module "${pageKey}" left alone (not CRM-owned: loaderRef=${existing.loaderRef})`);
    }
  }

  console.log('[CRM Phase 3a rollback] Removing CRM designer drafts…');
  for (const draftId of allDraftIds) {
    const removedDraft = deleteDesignerDraft(draftId);
    console.log(`  draft ${draftId}: ${removedDraft ? 'removed' : 'absent'}`);
  }

  console.log('[CRM Phase 3a rollback] Done.');
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
    console.error('[CRM Phase 3a]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
