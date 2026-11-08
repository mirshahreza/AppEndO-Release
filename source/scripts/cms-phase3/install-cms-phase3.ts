/**
 * CMS domain — Phase 3 (Client Components + Studio Pages + group nav `CMS` + Vocabulary).
 *
 * Opt-in only. Publishes designer components, registers route bindings on
 * `mountId: 'studio'` with `routePattern` prefixed `cms/…`, and adds an independent
 * `heading: "CMS"` group to `navigation/studio.json` — never a separate portal /
 * `navigation/cms.json` / `portalSegment: cms`.
 *
 * Usage:
 *   npm run cms:phase3
 *   npm run cms:phase3:rollback
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
  buildCmsContentsEditorDraft,
  buildCmsContentsListDraft,
  buildCmsSettingsDraft,
  buildCmsVocabularyPage,
  type CmsDesignerDraftBundle,
} from './cmsDesignerScaffold';
import { resolveCmsFilterOptions, resolveCmsIds, type CmsResolvedIds } from './cmsIds';
import { removeCmsPortal } from './cmsPortal';
import {
  buildCmsStudioNavGroup,
  CMS_ROUTE_PREFIX,
  removeCmsStudioNavGroup,
  upsertCmsStudioNavGroup,
} from './cmsStudioNav';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'cms-phase3';

type VocabSpec = {
  slug: string;
  title: string;
  categoryKey: keyof CmsResolvedIds['categoryIds'];
  pageName: string;
  settingsSectionId: 'content-types' | 'statuses' | 'languages' | 'content-tags';
  /** false = read-only (fixed enum the app's behavior hardcodes against). Defaults true. */
  editable?: boolean;
};

// Manageable Base Info categories under CMS Settings left rail (not main menu).
const VOCAB_SPECS: VocabSpec[] = [
  {
    slug: 'content-tags',
    title: 'Content Tags',
    categoryKey: 'Content Tags',
    pageName: 'cms-vocab-content-tags',
    settingsSectionId: 'content-tags',
  },
  {
    slug: 'content-types',
    title: 'Content Types',
    categoryKey: 'Content Types',
    pageName: 'cms-vocab-content-types',
    settingsSectionId: 'content-types',
  },
  {
    slug: 'statuses',
    title: 'Statuses',
    categoryKey: 'Statuses',
    pageName: 'cms-vocab-statuses',
    settingsSectionId: 'statuses',
  },
  {
    slug: 'languages',
    title: 'Languages',
    pageName: 'cms-vocab-languages',
    categoryKey: 'Languages',
    settingsSectionId: 'languages',
  },
];

/** Removed in round 5 — rollback must delete drafts/page-modules from older installs. */
const LEGACY_VOCAB_PAGE_NAMES = [
  'cms-vocab-content-status',
  'cms-vocab-body-formats',
  'cms-vocab-comment-status',
  'cms-vocab-comment-policies',
] as const;

/** Standalone comments list — moderation lives in the contents editor. */
const RETIRED_STANDALONE_PAGE_NAMES = ['cms-comments'] as const;

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const cmsOwnedLoaderRef = (bundleName: string, loaderRef: string | null | undefined): boolean => (
  Boolean(
    loaderRef
    && (loaderRef.startsWith(`cms/${bundleName}@`) || loaderRef.startsWith(`general/${bundleName}@`)),
  )
);

const removeCmsPageArtifacts = async (bundleNames: readonly string[]): Promise<void> => {
  for (const bundleName of bundleNames) {
    const draftId = `draft-${bundleName}`;
    const removedDraft = deleteDesignerDraft(draftId);
    if (removedDraft) console.log(`  retired draft removed: ${draftId}`);

    for (const folder of ['cms', 'general'] as const) {
      const componentPath = `${folder}/${bundleName}`;
      const pageKey = resolveExperienceManifestPageKey(componentPath);
      if (!pageKey) continue;
      const existing = await findPlatformPageModuleByKey(pageKey);
      if (existing && cmsOwnedLoaderRef(bundleName, existing.loaderRef)) {
        await deletePlatformPageModule(pageKey);
        console.log(`  retired page-module removed: ${pageKey}`);
      }
    }
  }
};

const removeCmsRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (!row.routePattern.startsWith(`${CMS_ROUTE_PREFIX}/`)) continue;
    await deletePlatformRouteBinding(row.id);
    removed += 1;
  }
  return removed;
};

const publishBundle = async (bundle: CmsDesignerDraftBundle, title: string): Promise<PublishedPage> => {
  const draftId = `draft-${bundle.name}`;
  const saved = saveDesignerDraft({
    id: draftId,
    name: bundle.name,
    folder: bundle.folder,
    document: { ...bundle.document, id: draftId, name: bundle.name },
    // `SaveDraftInput.bindingDefinitions` is (mis)typed as `Record<string,
    // DesignerBindingDefinition>`; every real production caller (e.g.
    // component-designer.service.ts) actually stores the full
    // `DesignerBindingDefinitions` ({storeSegments,dataSources,lovs}) shape here
    // and force-casts past the stale annotation — same cast, same real shape.
    bindingDefinitions: bundle.bindingDefinitions as unknown as Record<string, import('../../src/domain/component-designer/types').DesignerBindingDefinition>,
    actor: ACTOR_LABEL,
  });
  const published = publishDesignerComponent(saved.id, ACTOR_LABEL);
  const loaderRef = published.loaderRef ?? `${bundle.folder}/${bundle.name}@v${published.publishedVersion}`;
  // publishDesignerComponent also fires an un-awaited background pin (designerRoutePropagation);
  // racing our own explicit (awaited) pin below can trip the page-module "already exists" insert
  // guard — retry once, by which point the background insert has settled and we take the update path.
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

  console.log('[CMS Phase 3] Resolving Base Info ids from Phase 1…');
  const ids = await resolveCmsIds();
  const filterOptions = await resolveCmsFilterOptions();

  console.log('[CMS Phase 3] Removing retired standalone CMS pages…');
  await removeCmsPageArtifacts(RETIRED_STANDALONE_PAGE_NAMES);

  console.log('[CMS Phase 3] Publishing Client Components…');
  const publishedPages: PublishedPage[] = [];

  const contentsList = await publishBundle(buildCmsContentsListDraft({
    filterOptions,
    statusIds: { archived: ids.statusIds.archived, draft: ids.statusIds.draft },
    baseInfoCategoryIds: ids.categoryIds,
  }), 'Contents');
  publishedPages.push(contentsList);

  const contentsEditor = await publishBundle(
    buildCmsContentsEditorDraft({
      bodyFormatIds: ids.bodyFormatIds,
      statusIds: ids.statusIds,
      commentStatusIds: ids.commentStatusIds,
      commentTypeCode: ids.contentTypeIds.comment,
      filterOptions,
      contentOptions: filterOptions.contents,
      baseInfoCategoryIds: ids.categoryIds,
    }),
    'Content Editor',
  );
  publishedPages.push(contentsEditor);

  const settings = await publishBundle(buildCmsSettingsDraft({
    commentPolicies: filterOptions.commentPolicies,
    commentBodyFormats: filterOptions.bodyFormats.filter(
      (option) => option.value === ids.bodyFormatIds.plain || option.value === ids.bodyFormatIds.html,
    ),
    baseInfoCategoryIds: ids.categoryIds,
  }), 'CMS Settings');
  publishedPages.push(settings);

  const vocabPages: Array<PublishedPage & { spec: VocabSpec }> = [];
  for (const spec of VOCAB_SPECS) {
    const published = await publishBundle(
      buildCmsVocabularyPage({
        pageName: spec.pageName,
        title: spec.title,
        categoryId: ids.categoryIds[spec.categoryKey],
        settingsSectionId: spec.settingsSectionId,
        editable: spec.editable,
      }),
      spec.title,
    );
    publishedPages.push(published);
    vocabPages.push({ ...published, spec });
  }

  console.log('[CMS Phase 3] Removing any leftover independent CMS portal (Round 4)…');
  const removedPortal = await removeCmsPortal({ userId: ACTOR.userId, username: ACTOR_LABEL });
  console.log(`  portal "cms": ${removedPortal ? 'removed' : 'already absent'}`);

  console.log('[CMS Phase 3] Clearing any previous CMS route bindings (idempotent re-run)…');
  const clearedBefore = await removeCmsRouteBindings();
  if (clearedBefore > 0) console.log(`  removed ${clearedBefore} stale route bindings`);

  console.log('[CMS Phase 3] Registering route bindings (mountId=studio, routePattern prefixed cms/…)…');
  const platform = new PlatformCrudService();
  // nav.group=CMS on list pages so Portals decompile→compile does not wipe the CMS sidebar
  // (bindings with nav:null never re-enter studio.json). Edit stays nav:null (deep-link only).
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
      routePattern: `${CMS_ROUTE_PREFIX}/contents`,
      pageKey: contentsList.pageKey,
      nav: {
        label: 'Contents',
        icon: 'Newspaper',
        group: 'CMS',
        order: 1,
        description: 'Write, version, publish, and archive editorial content.',
        color: 'text-sky-600',
      },
    },
    {
      routePattern: `${CMS_ROUTE_PREFIX}/contents/edit/*`,
      pageKey: contentsEditor.pageKey,
      // Not listed in studio.json's nav manifest (buildCmsStudioNavGroup never
      // references it), so this never creates a visible sidebar item — it only
      // supplies `nav.group` so the admin shell header can render
      // "CMS / Contents / {id}" with the nested-editor override on DesignerPublishedPage.
      nav: {
        label: 'Contents',
        icon: 'Newspaper',
        group: 'CMS',
        order: 1,
        description: 'Edit a single content record.',
        color: 'text-sky-600',
      },
    },
    {
      routePattern: `${CMS_ROUTE_PREFIX}/settings/*`,
      pageKey: settings.pageKey,
      nav: {
        label: 'Settings',
        icon: 'Settings',
        group: 'CMS',
        order: 2,
        description: 'Domain settings and Base Info vocabularies.',
        color: 'text-slate-600',
        separatorBefore: true,
      },
    },
    // Vocab sections are reached via the Settings left rail (like platform Settings).
    // nav:null keeps them out of the main Studio menu on portal recompile.
    ...vocabPages.map((page) => ({
      routePattern: `${CMS_ROUTE_PREFIX}/settings/${page.spec.slug}`,
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

  console.log('[CMS Phase 3] Upserting Studio nav group heading=CMS…');
  upsertCmsStudioNavGroup(buildCmsStudioNavGroup({
    contents: {
      pageKey: contentsList.pageKey,
      routePattern: `${CMS_ROUTE_PREFIX}/contents`,
      label: 'Contents',
      icon: 'Newspaper',
      description: 'Write, version, publish, and archive editorial content.',
      iconColor: 'text-sky-600',
      order: 1,
    },
    settings: {
      pageKey: settings.pageKey,
      routePattern: `${CMS_ROUTE_PREFIX}/settings/*`,
      label: 'Settings',
      icon: 'Settings',
      description: 'Domain settings and Base Info vocabularies.',
      iconColor: 'text-slate-600',
      order: 2,
    },
  }));

  console.log('[CMS Phase 3] Done.');
  console.log('  Open: /{culture}/studio/cms/contents (e.g. /us/studio/cms/contents)');
  console.log(`  Pages published: ${publishedPages.length} (Client Components, loaderKind=designer)`);
  console.log('  Nav: Studio sidebar → group CMS (Contents | Settings); comments live in the contents editor; vocab via Settings left rail');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CMS Phase 3 rollback] Removing CMS route bindings…');
  const removedRoutes = await removeCmsRouteBindings();
  console.log(`  route bindings removed: ${removedRoutes}`);

  console.log('[CMS Phase 3 rollback] Removing Studio nav group CMS…');
  const removedNav = removeCmsStudioNavGroup();
  console.log(`  studio nav group CMS: ${removedNav ? 'removed' : 'already absent'}`);

  console.log('[CMS Phase 3 rollback] Removing any leftover CMS portal…');
  const removedPortal = await removeCmsPortal({ userId: ACTOR.userId, username: ACTOR_LABEL });
  console.log(`  portal "cms": ${removedPortal ? 'removed' : 'already absent'}`);

  const allPageKeys = [
    'cms-contents-list', 'cms-contents-editor', 'cms-settings',
    ...VOCAB_SPECS.map((spec) => spec.pageName),
    ...LEGACY_VOCAB_PAGE_NAMES,
    ...RETIRED_STANDALONE_PAGE_NAMES,
  ];
  const allDraftIds = allPageKeys.map((name) => `draft-${name}`);

  console.log('[CMS Phase 3 rollback] Removing CMS page modules…');
  for (const bundleName of allPageKeys) {
    for (const folder of ['cms', 'general'] as const) {
      const componentPath = `${folder}/${bundleName}`;
      const pageKey = resolveExperienceManifestPageKey(componentPath);
      if (!pageKey) continue;
      const existing = await findPlatformPageModuleByKey(pageKey);
      // Safety net: only delete a page-module this script actually owns (pageKey is a
      // global namespace — never delete on a bare key match without confirming loaderRef).
      if (existing && cmsOwnedLoaderRef(bundleName, existing.loaderRef)) {
        await deletePlatformPageModule(pageKey);
        console.log(`  page-module removed: ${pageKey}`);
      } else if (existing && folder === 'cms') {
        console.log(`  page-module "${pageKey}" left alone (not CMS-owned: loaderRef=${existing.loaderRef})`);
      }
    }
  }

  console.log('[CMS Phase 3 rollback] Removing CMS designer drafts…');
  for (const draftId of allDraftIds) {
    const removedDraft = deleteDesignerDraft(draftId);
    console.log(`  draft ${draftId}: ${removedDraft ? 'removed' : 'absent'}`);
  }

  console.log('[CMS Phase 3 rollback] Done.');
};

const main = async () => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CMS Phase 3] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
