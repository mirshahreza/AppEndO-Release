/**
 * CRM domain — زیرفاز 3b (Customers list + deep editor — the "golden" reference page).
 *
 * Adds ITS OWN item to the CRM nav group on top of whatever 3a already registered
 * (Settings) — never re-derives or duplicates 3a's registration. Requires 3a installed.
 *
 * Usage:
 *   npm run crm:phase3b
 *   npm run crm:phase3b:rollback
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
import { buildCrmCustomersEditorDraft, buildCrmCustomersListDraft } from './crmCustomersScaffold';
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
const ACTOR_LABEL = 'crm-phase3b';

const LIST_PAGE_NAME = 'crm-customers';
const EDITOR_PAGE_NAME = 'crm-customers-editor';

type PublishedPage = { draftId: string; pageKey: string; loaderRef: string; folder: string; name: string };

const removeCrmCustomersRouteBindings = async (): Promise<number> => {
  let removed = 0;
  const rows = await listPlatformRouteBindingRows();
  for (const row of rows) {
    if (row.mountId !== 'studio') continue;
    if (row.routePattern !== `${CRM_ROUTE_PREFIX}/customers` && !row.routePattern.startsWith(`${CRM_ROUTE_PREFIX}/customers/`)) continue;
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

  console.log('[CRM 3b] Resolving Base Info ids + vocab options from Phase 1…');
  const ids = await resolveCrmIds();
  const filterOptions = await resolveCrmFilterOptions(ids);

  console.log('[CRM 3b] Publishing Customers list + editor (Client Components)…');
  const list = await publishBundle(buildCrmCustomersListDraft({ filterOptions }), 'Customers');
  const editor = await publishBundle(buildCrmCustomersEditorDraft({ filterOptions }), 'Customer Editor');

  console.log('[CRM 3b] Clearing any previous crm/customers route bindings (idempotent re-run)…');
  const cleared = await removeCrmCustomersRouteBindings();
  if (cleared > 0) console.log(`  removed ${cleared} stale route bindings`);

  console.log('[CRM 3b] Registering route bindings (crm/customers · crm/customers/edit/*)…');
  const platform = new PlatformCrudService();
  const listNav = {
    label: 'Customers',
    icon: 'Contact',
    group: 'CRM',
    order: 1,
    description: 'Platform users tracked as CRM customers.',
    color: 'text-sky-600',
  };

  const listBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${CRM_ROUTE_PREFIX}/customers`,
    pageKey: list.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    nav: listNav,
  });
  console.log(`  route binding created: ${CRM_ROUTE_PREFIX}/customers → ${list.pageKey} (#${listBinding.body.id})`);

  // Edit route carries the same nav metadata (shell header group) but is never added to the
  // Studio sidebar nav group itself — same convention CMS's contents/edit/* binding uses.
  const editorBinding = await platform.createRouteBinding(ACTOR, {
    mountId: 'studio',
    routePattern: `${CRM_ROUTE_PREFIX}/customers/edit/*`,
    pageKey: editor.pageKey,
    enabled: true,
    auth: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    nav: { ...listNav, description: 'Edit a single customer record.' },
  });
  console.log(`  route binding created: ${CRM_ROUTE_PREFIX}/customers/edit/* → ${editor.pageKey} (#${editorBinding.body.id})`);

  console.log('[CRM 3b] Upserting Studio nav group heading=CRM (prepending Customers before Settings)…');
  const nav = readNavigationFile('studio');
  const existingGroup = (nav?.groups ?? []).find((g) => g.heading === CRM_STUDIO_GROUP_HEADING);
  const existingItems = (existingGroup?.items ?? []).filter((item) => item.pageKey !== list.pageKey);
  const customersNavPage: CrmStudioNavPage = {
    pageKey: list.pageKey,
    routePattern: `${CRM_ROUTE_PREFIX}/customers`,
    label: listNav.label,
    icon: listNav.icon,
    description: listNav.description,
    iconColor: listNav.color,
    order: listNav.order,
  };
  const navPages: CrmStudioNavPage[] = [
    customersNavPage,
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
  upsertCrmStudioNavGroup(buildCrmStudioNavGroup(navPages));

  console.log('[CRM 3b] Done.');
  console.log('  Open: /{culture}/studio/crm/customers (e.g. /us/studio/crm/customers)');
  console.log('  Nav: Studio sidebar → group CRM → Customers (+ Settings from 3a)');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CRM 3b rollback] Removing crm/customers route bindings…');
  const removedRoutes = await removeCrmCustomersRouteBindings();
  console.log(`  route bindings removed: ${removedRoutes}`);

  console.log('[CRM 3b rollback] Removing Customers item from Studio nav group CRM…');
  const nav = readNavigationFile('studio');
  const group = (nav?.groups ?? []).find((g) => g.heading === CRM_STUDIO_GROUP_HEADING);
  if (group) {
    const remainingItems = group.items.filter((item) => {
      const pageKey = resolveExperienceManifestPageKey(`crm/${LIST_PAGE_NAME}`);
      return item.pageKey !== pageKey;
    });
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
  console.log('[CRM 3b rollback] Removing CRM Customers page modules…');
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

  console.log('[CRM 3b rollback] Removing CRM Customers designer drafts…');
  for (const bundleName of pageNames) {
    const removedDraft = deleteDesignerDraft(`draft-${bundleName}`);
    console.log(`  draft draft-${bundleName}: ${removedDraft ? 'removed' : 'absent'}`);
  }

  console.log('[CRM 3b rollback] Done.');
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
    console.error('[CRM 3b]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
