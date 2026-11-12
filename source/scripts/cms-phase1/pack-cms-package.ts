/**
 * Build a CMS extension ZIP from the live node: schema + Base Info vocab,
 * optional content/files, Designer CMS pages, and cms_* edge models/APIs.
 * Data API operations are packed as `capabilities.edge_apis` (published into
 * Server Functions on install) — not as `capabilities.apis`.
 *
 *   npx tsx scripts/cms-phase1/pack-cms-package.ts
 *   npx tsx scripts/cms-phase1/pack-cms-package.ts --upload
 *   npx tsx scripts/cms-phase1/pack-cms-package.ts --reinstall
 */
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { computePackageArtifactHashFromZip } from '../../src/core/packages/packageArtifactHash';
import { uploadPackageArtifact } from '../../src/core/packages/PackageArtifactService';
import { validateManifest } from '../../src/core/packages/PackageManifestValidator';
import { capturedBlobsToArtifactFiles, capturedHidRowsToArtifactFiles } from '../../src/features/packages/lib/packageDbBlobPacking';
import {
  OPTIONAL_INSTALL_SQL_ENTRY,
  OPTIONAL_UNINSTALL_SQL_ENTRY,
  REQUIRED_INSTALL_SQL_ENTRY,
  REQUIRED_UNINSTALL_SQL_ENTRY,
  buildPackageBuilderDbObjects,
} from '../../src/features/packages/lib/packageBuilderInitialRecords';
import { joinCapturedSqlParts } from '../../src/features/packages/lib/packageCmsModuleCapture';
import {
  buildPackageDesignerPageDraftEntry,
  buildPackageUiEntryPath,
} from '../../src/features/packages/lib/packageUiEntryPath';
import { buildPackageUiRoutesForPageSeeds, applyStudioRoutePatternsToUiRoutes } from '../../src/features/packages/lib/packageUiRoutesFromComponents';
import {
  buildPackageStudioModuleExtras,
  studioModuleExtraFiles,
} from '../../src/features/packages/lib/packageStudioModuleExtras';
import {
  publicSiteHomePortalArtifactFile,
  publicSiteHomePortalCapability,
  shouldPackPublicSiteHomePortal,
} from '../../src/features/packages/lib/packageHomePortalPacking';
import { DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY } from '../../src/shared/api/contracts/package-manifest/types';
import { resolveActiveSettingsPath } from '../../src/server/config/settingsFile';
import { hydrateDataSourcePassword } from '../../src/server/config/dataSourceSecrets';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import type { StoredDataSource } from '../../src/core/database/EdgeDbRouter';
import { closePrismaControlPlane, initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import {
  isPluginRuntimeEnabled,
  readInstallStateV1,
} from '../../src/server/domain/package-domain/installStateRepository';
import { getDefaultPackageLifecycleCoordinator } from '../../src/server/services/package-runtime/packageLifecycle.service';
import { bootstrapPlatformSettingsCaches } from '../../src/server/services/settings/bootstrapPlatformSettings';
import { flushPlatformBlobWrites } from '../../src/server/services/settings/platformSettingsCache';
import { listDesignerDrafts } from '../../src/server/domain/component-designer/drafts';
import { isRetiredDesignerCatalogComponent } from '../../src/shared/lib/packageStudioSidebar';
import { listRouteBindingFiles } from '../../src/core/platform-registry/PlatformRegistryFileStore';
import { listEdgeApiDefinitions } from '../../src/server/services/data-api/edgeApiStore';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { buildDesignerComponentExportBundle } from '../../src/server/services/package/packageComponentExport.service';
import { captureCmsModule } from '../../src/server/services/package/packageDbCapture.service';
import { buildPackageEdgeDataExportEntries } from '../../src/server/services/package/packageEdgeDataExport.service';
import {
  buildCmsPublicSiteUiFiles,
  mergeCmsPublicSiteCapabilities,
} from '../../src/core/packages/cmsPublicSitePack';
import { CMS_HOME_WIDGET_CULTURE_KEYS } from '../../src/core/packages/cmsHomeWidgetCultureKeys';

const PACKAGE_ID = 'cms';
const PACKAGE_NAME = 'CMS';
const PACKAGE_VERSION = '1.3.9';

const isCmsDraft = (folder: string, name: string, id: string): boolean => {
  const haystack = `${folder}/${name}/${id}`.replace(/\\/g, '/').toLowerCase();
  return haystack.includes('cms-') || haystack.includes('/cms/') || folder.trim().toLowerCase() === 'cms';
};

const isCmsObjectName = (objectName: string): boolean => objectName.trim().toLowerCase().startsWith('cms_');

const CLONE_DEV_SQL_LOGIN = 'appendo_clone_dev';

const packDataSourcesForCmsCapture = (settingsPath: string): StoredDataSource[] => {
  const hydrated = getDataSourcesFromSettings(settingsPath).map((item) =>
    hydrateDataSourcePassword(item),
  );
  const overrideLogin = process.env.APPENDO_CMS_PACK_SQL_LOGIN?.trim();
  if (overrideLogin !== CLONE_DEV_SQL_LOGIN) {
    return hydrated;
  }
  const password = process.env.APPENDO_CLONE_SQL_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'APPENDO_CLONE_SQL_PASSWORD is required when APPENDO_CMS_PACK_SQL_LOGIN=appendo_clone_dev.',
    );
  }
  return hydrated.map((item) =>
    item.isDefault
      ? {
          ...item,
          username: CLONE_DEV_SQL_LOGIN,
          password,
          passwordCipher: undefined,
          passwordEnvKey: undefined,
        }
      : item,
  );
};

async function main(): Promise<void> {
  const reinstallFlag = process.argv.includes('--reinstall');
  const upload = process.argv.includes('--upload') || reinstallFlag;
  const settingsPath = resolveActiveSettingsPath();
  const sources = packDataSourcesForCmsCapture(settingsPath);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('No data source is configured in settings.json.');
  }

  console.log(`Data source: ${source.name} (${source.type} / ${source.id})`);

  const edgeDbQuery = createEdgeDbQueryExecutor({
    getDataSources: () => packDataSourcesForCmsCapture(settingsPath),
  });

  console.log('Capturing CMS schema, vocab, content, and files…');
  const captured = await captureCmsModule(
    { edgeDbQuery, settingsPath },
    { dataSourceId: source.id, includeOptionalRecords: true },
  );

  for (const warning of captured.warnings) {
    console.warn(`  warning: ${warning}`);
  }
  console.log(`  schema: ${captured.schemaInstallSql.trim() ? 'yes' : 'no'}`);
  console.log(`  vocab rows: ${captured.vocabRowCount}`);
  console.log(`  content rows: ${captured.contentRowCount}`);
  console.log(`  files: ${captured.contentBlobs.length}`);
  console.log(`  tables: ${captured.tables.join(', ') || '(none)'}`);

  const installSql = joinCapturedSqlParts(captured.schemaInstallSql, captured.vocabInstallSql);
  const uninstallSql = joinCapturedSqlParts(captured.schemaUninstallSql, captured.vocabUninstallSql);
  const optionalInstallSql = captured.contentInstallSql;
  const optionalUninstallSql = captured.contentUninstallSql;

  const pageSeeds = listDesignerDrafts()
    .filter((draft) => isCmsDraft(draft.folder, draft.name, draft.id))
    .filter((draft) => !isRetiredDesignerCatalogComponent(draft.name))
    .map((draft) => {
      const bundle = buildDesignerComponentExportBundle(draft.id);
      if (!bundle.ok) {
        console.warn(`  skipped Designer draft ${draft.id}: ${bundle.error}`);
        return null;
      }
      return {
        id: draft.id,
        componentKey: bundle.componentKey,
        label: bundle.label,
        exportBundle: {
          entry: bundle.entry,
          code: bundle.code,
          draftJson: bundle.draftJson,
          draftEntry: bundle.draftEntry,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  console.log(`Designer CMS pages: ${pageSeeds.length}`);
  for (const page of pageSeeds) {
    console.log(`  ${page.componentKey}`);
  }

  const cmsModels = listEdgeModels().filter((model) => isCmsObjectName(model.objectName));
  const cmsModelIds = new Set(cmsModels.map((model) => model.id));
  const cmsApis = listEdgeApiDefinitions().filter((api) => cmsModelIds.has(api.edgeModelId));
  console.log(`Edge models: ${cmsModels.map((model) => model.objectName).join(', ') || '(none)'}`);
  console.log(`Edge APIs: ${cmsApis.map((api) => api.key).join(', ') || '(none)'}`);

  const edgeExport = buildPackageEdgeDataExportEntries({
    edgeModelIds: cmsModels.map((model) => model.id),
    edgeApiIds: cmsApis.map((api) => api.id),
  });
  if ('ok' in edgeExport && edgeExport.ok === false) {
    throw new Error(edgeExport.error);
  }
  const edge = edgeExport as Exclude<typeof edgeExport, { ok: false }>;
  for (const warning of edge.warnings) {
    console.warn(`  warning: ${warning}`);
  }

  const uiRoutes = applyStudioRoutePatternsToUiRoutes(
    buildPackageUiRoutesForPageSeeds({ pageSeeds }),
    listRouteBindingFiles(),
  );
  const studioExtras = buildPackageStudioModuleExtras({
    packageName: PACKAGE_NAME,
    routes: uiRoutes,
    pageSeeds,
  });

  const dbObjects = buildPackageBuilderDbObjects({
    packageId: PACKAGE_ID,
    installSql,
    uninstallSql,
    includeInitialRecords: true,
    optionalInstallSql,
    optionalUninstallSql,
  });

  const zip = new AdmZip();
  const addText = (entry: string, content: string) => {
    zip.addFile(entry, Buffer.from(content.endsWith('\n') ? content : `${content}\n`, 'utf8'));
  };

  pageSeeds.forEach((page) => {
    const entry = page.exportBundle?.entry ?? buildPackageUiEntryPath(page.componentKey);
    addText(entry, page.exportBundle?.code ?? 'export default function Page() { return null; }\n');
    if (page.exportBundle?.draftJson) {
      addText(
        page.exportBundle.draftEntry ?? buildPackageDesignerPageDraftEntry(page.componentKey),
        page.exportBundle.draftJson,
      );
    }
  });

  for (const file of edge.zipEntries) {
    zip.addFile(file.path, file.content);
  }
  if (installSql.trim()) addText(REQUIRED_INSTALL_SQL_ENTRY, installSql);
  if (uninstallSql.trim()) addText(REQUIRED_UNINSTALL_SQL_ENTRY, uninstallSql);
  if (optionalInstallSql.trim()) addText(OPTIONAL_INSTALL_SQL_ENTRY, optionalInstallSql);
  if (optionalUninstallSql.trim()) addText(OPTIONAL_UNINSTALL_SQL_ENTRY, optionalUninstallSql);

  for (const file of capturedBlobsToArtifactFiles(captured.contentBlobs)) {
    zip.addFile(file.entryName, Buffer.from(file.data));
  }
  for (const file of capturedHidRowsToArtifactFiles(captured.vocabHidRows)) {
    zip.addFile(file.entryName, Buffer.from(file.data));
  }
  if (studioExtras) {
    studioExtras.cultureKeys = {
      ...studioExtras.cultureKeys,
      ...CMS_HOME_WIDGET_CULTURE_KEYS,
    };
    for (const file of studioModuleExtraFiles(studioExtras)) {
      addText(file.entry, file.content);
    }
  }
  if (shouldPackPublicSiteHomePortal(PACKAGE_ID)) {
    const homePortal = publicSiteHomePortalArtifactFile();
    addText(homePortal.entry, homePortal.content);
  }
  for (const file of buildCmsPublicSiteUiFiles()) {
    addText(file.entry, file.source);
  }

  const publicSiteUi = mergeCmsPublicSiteCapabilities({
    ui_routes: uiRoutes,
    // Studio Designer pages are not Home dashboard widgets — review queue uses core `module:cms-contents-list:review-queue`.
    ui_components: [],
  });

  const manifest = {
    $schemaVersion: '1.0',
    id: PACKAGE_ID,
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    description: 'CMS Studio module packed from the live node (schema, vocab, content, files, Designer pages). Home review-queue widget ships via core registry + culture keys.',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      // Published Data API operations are packed as edge_apis, not duplicate capabilities.apis.
      apis: [],
      ui_components: publicSiteUi.ui_components,
      ui_routes: publicSiteUi.ui_routes,
      ...(studioExtras
        ? {
          navigation_patches: [studioExtras.navigationPatchCapability],
          culture_keys: [studioExtras.cultureKeysCapability],
        }
        : {}),
      ...(shouldPackPublicSiteHomePortal(PACKAGE_ID)
        ? { home_portal: publicSiteHomePortalCapability() }
        : {}),
      db_objects: dbObjects,
      mcp_servers: [],
      ...(edge.capabilities.edge_models.length > 0 ? { edge_models: edge.capabilities.edge_models } : {}),
      ...(edge.capabilities.edge_apis.length > 0 ? { edge_apis: edge.capabilities.edge_apis } : {}),
      ...(edge.capabilities.edge_model_studio_meta.length > 0
        ? { edge_model_studio_meta: edge.capabilities.edge_model_studio_meta }
        : {}),
      ...(edge.capabilities.scope_dimensions?.length
        ? { scope_dimensions: edge.capabilities.scope_dimensions }
        : {}),
      ...(edge.capabilities.record_policies?.length
        ? { record_policies: edge.capabilities.record_policies }
        : {}),
      ...(edge.capabilities.record_policy_bindings?.length
        ? { record_policy_bindings: edge.capabilities.record_policy_bindings }
        : {}),
    },
    overridePolicy: {
      apis: 'deny' as const,
      ui_components: 'deny' as const,
      db_objects: 'deny' as const,
      mcp_servers: 'deny' as const,
    },
    integrity: {
      algorithm: 'sha256' as const,
      artifactHash: '0'.repeat(64),
    },
  };

  manifest.integrity.artifactHash = computePackageArtifactHashFromZip(zip);
  addText('package.json', JSON.stringify(manifest, null, 2));

  const validated = validateManifest(JSON.parse(zip.readAsText('package.json')));
  if (!validated.valid) {
    throw new Error(`Manifest invalid:\n${(validated.errors ?? []).join('\n')}`);
  }

  const outDir = path.join(process.cwd(), 'packages-storage', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${PACKAGE_ID}-${PACKAGE_VERSION}.zip`);
  zip.writeZip(outPath);
  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${zip.getEntries().length} entries)`);

  if (upload) {
    const result = await uploadPackageArtifact(fs.readFileSync(outPath), path.basename(outPath), 'admin');
    if (!result.success) {
      throw new Error(result.error + (result.details?.length ? `\n${result.details.join('\n')}` : ''));
    }
    console.log(`Uploaded ${result.packageId}@${result.version}`);
  }

  if (reinstallFlag) {
    await initPrismaControlPlane(settingsPath);
    await bootstrapPlatformSettingsCaches();
    const lifecycle = getDefaultPackageLifecycleCoordinator();
    const installOptions = {
      version: PACKAGE_VERSION,
      overridePolicy: DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
      installOptionalRecords: true,
    };
    const alreadyInstalled = isPluginRuntimeEnabled(PACKAGE_ID);
    const installState = readInstallStateV1(PACKAGE_ID);
    const hadSuccessfulInstall = (installState?.history ?? []).some(
      (entry) => entry.operation === 'install' && entry.result === 'success',
    );
    const refreshRuntimeOnly =
      installState?.status === 'failed' || (reinstallFlag && hadSuccessfulInstall);
    const result = alreadyInstalled
      ? await lifecycle.reinstall(PACKAGE_ID, 'pack-cms-package', installOptions)
      : await lifecycle.install(PACKAGE_ID, 'pack-cms-package', {
        ...installOptions,
        ...(refreshRuntimeOnly ? { skipInstallDbScripts: true } : {}),
      });
    if (!result.success) {
      throw new Error(
        `${result.error ?? 'CMS package lifecycle failed.'}${result.details?.length ? `\n${result.details.join('\n')}` : ''}`,
      );
    }
    console.log(
      alreadyInstalled
        ? `Reinstalled ${PACKAGE_ID}@${PACKAGE_VERSION}`
        : `Installed ${PACKAGE_ID}@${PACKAGE_VERSION}`,
    );
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushPlatformBlobWrites();
    await closePrismaControlPlane();
  });
