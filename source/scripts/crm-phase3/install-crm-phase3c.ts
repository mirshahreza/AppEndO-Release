/**
 * CRM domain — زیرفاز 3c (Opportunities: Kanban + grid + deep editor).
 *
 * Adds ITS OWN item to the CRM nav group on top of whatever 3a/3b already registered
 * (Settings, Customers) — never re-derives or duplicates their registration. Requires
 * 3a/3b/3c-pre done first.
 *
 * Usage:
 *   npm run crm:phase3c
 *   npm run crm:phase3c:rollback
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
import type { CrmDesignerDraftBundle } from './crmDesignerScaffold';
import { buildCrmOpportunitiesEditorDraft, buildCrmOpportunitiesListDraft } from './crmOpportunitiesScaffold';
import { resolveCrmFilterOptions, resolveCrmIds } from './crmIds';
import {
  buildCrmStudioNavGroup,
  CRM_ROUTE_PREFIX,
  CRM_STUDIO_GROUP_HEADING,
  upsertCrmStudioNavGroup,
  type CrmStudioNavPage,
} from './crmStudioNav';

const isRollback = process.argv.includes('--rollback');
const ACTOR: ActorContext = { userId: 1, isAdmin: true };
const ACTOR_LABEL = 'crm-phase3c';

const LIST_PAGE_NAME = 'crm-opportunities';
const EDITOR_PAGE_NAME = 'crm-opportunities-editor';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeCrmOpportunitiesRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (row.routePattern !== `${CRM_ROUTE_PREFIX}/opportunities` && !row.routePattern.startsWith(`${CRM_ROUTE_PREFIX}/opportunities/`)) continue;
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

  console.log('[CRM 3c] Resolving Base Info ids + vocab options from Phase 1…');
  const ids = await resolveCrmIds();
  const filterOptions = await resolveCrmFilterOptions(ids);

  console.log('[CRM 3c] Publishing Opportunities list (Kanban + grid) + editor (Client Components)…');
  const list = await publishBundle(buildCrmOpportunitiesListDraft({ filterOptions }), 'Opportunities');
  const editor = await publishBundle(buildCrmOpportunitiesEditorDraft(), 'Opportunity Editor');

  console.log('[CRM 3c] Clearing any previous crm/opportunities route bindings (idempotent re-run)…');
  const cleared = await removeCrmOpportunitiesRouteBindings();
  if (cleared > 0) console.log(`  removed ${cleared} stale route bindings`);

  console.log('[CRM 3c] Registering route bindings (crm/opportunities · crm/opportunities/edit/*)…');
  const platform = new PlatformCrudService();
  const listNav = {
    label: 'Opportunities',
    icon: 'Kanban',
    group: 'CRM',
    order: 2,
    description: 'Pipeline opportunities and stages.',
    color: 'text-violet-600',
  };

  const listBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${CRM_ROUTE_PREFIX}/opportunities`,
    pageKey: list.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    nav: listNav,
  });
  console.log(`  route binding created: ${CRM_ROUTE_PREFIX}/opportunities → ${list.pageKey} (#${listBinding.body.id})`);

  const editorBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${CRM_ROUTE_PREFIX}/opportunities/edit/*`,
    pageKey: editor.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    nav: { ...listNav, description: 'Edit a single opportunity record.' },
  });
  console.log(`  route binding created: ${CRM_ROUTE_PREFIX}/opportunities/edit/* → ${editor.pageKey} (#${editorBinding.body.id})`);

  console.log('[CRM 3c] Upserting Studio nav group heading=CRM (inserting Opportunities after Customers)…');
  const nav = readNavigationFile('studio');
  const existingGroup = (nav?.groups ?? []).find((g) => g.heading === CRM_STUDIO_GROUP_HEADING);
  const existingItems = (existingGroup?.items ?? []).filter((item) => item.pageKey !== list.pageKey);
  const opportunitiesNavPage: CrmStudioNavPage = {
    pageKey: list.pageKey,
    routePattern: `${CRM_ROUTE_PREFIX}/opportunities`,
    label: listNav.label,
    icon: listNav.icon,
    description: listNav.description,
    iconColor: listNav.color,
    order: listNav.order,
  };
  const navPages: CrmStudioNavPage[] = [
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
    opportunitiesNavPage,
  ].sort((a, b) => a.order - b.order);
  upsertCrmStudioNavGroup(buildCrmStudioNavGroup(navPages));

  console.log('[CRM 3c] Done.');
  console.log('  Open: /{culture}/studio/crm/opportunities (e.g. /us/studio/crm/opportunities)');
  console.log('  Nav: Studio sidebar → group CRM → Customers · Opportunities (+ Settings from 3a)');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CRM 3c rollback] Removing crm/opportunities route bindings…');
  const removedRoutes = await removeCrmOpportunitiesRouteBindings();
  console.log(`  route bindings removed: ${removedRoutes}`);

  console.log('[CRM 3c rollback] Removing Opportunities item from Studio nav group CRM…');
  const nav = readNavigationFile('studio');
  const group = (nav?.groups ?? []).find((g) => g.heading === CRM_STUDIO_GROUP_HEADING);
  if (group) {
    const pageKey = resolveExperienceManifestPageKey(`crm/${LIST_PAGE_NAME}`);
    const remainingItems = group.items.filter((item) => item.pageKey !== pageKey);
    const navPages: CrmStudioNavPage[] = remainingItems.map((item) => ({
      pageKey: item.pageKey,
      routePattern: item.routePattern,
      label: item.label,
      icon: item.icon,
      description: item.description ?? '',
      iconColor: item.iconColor ?? 'text-slate-600',
      order: item.order ?? 99,
      separatorBefore: item.separatorBefore,
    }));
    upsertCrmStudioNavGroup(buildCrmStudioNavGroup(navPages));
  }

  const pageNames = [LIST_PAGE_NAME, EDITOR_PAGE_NAME];
  console.log('[CRM 3c rollback] Removing CRM Opportunities page modules…');
  for (const bundleName of pageNames) {
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

  console.log('[CRM 3c rollback] Removing CRM Opportunities designer drafts…');
  for (const bundleName of pageNames) {
    const removedDraft = deleteDesignerDraft(`draft-${bundleName}`);
    console.log(`  draft draft-${bundleName}: ${removedDraft ? 'removed' : 'absent'}`);
  }

  console.log('[CRM 3c rollback] Done.');
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
    console.error('[CRM 3c]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
