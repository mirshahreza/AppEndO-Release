/**
 * Build a Voting vertical-app ZIP from the live node (schema + Base Info + Designer pages + edge APIs).
 *
 *   npm run voting:pack
 *   npm run voting:pack -- --upload
 */
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { computePackageArtifactHashFromZip } from '../../src/core/packages/packageArtifactHash';
import { uploadPackageArtifact } from '../../src/core/packages/PackageArtifactService';
import { validateManifest } from '../../src/core/packages/PackageManifestValidator';
import { capturedHidRowsToArtifactFiles } from '../../src/features/packages/lib/packageDbBlobPacking';
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
import { DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY } from '../../src/shared/api/contracts/package-manifest/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { listDesignerDrafts } from '../../src/server/domain/component-designer/drafts';
import { isRetiredDesignerCatalogComponent } from '../../src/shared/lib/packageStudioSidebar';
import { listRouteBindingFiles } from '../../src/core/platform-registry/PlatformRegistryFileStore';
import { listEdgeApiDefinitions } from '../../src/server/services/data-api/edgeApiStore';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { buildDesignerComponentExportBundle } from '../../src/server/services/package/packageComponentExport.service';
import {
  captureSeedInserts,
  readCapturableSqlFile,
} from '../../src/server/services/package/packageDbCapture.service';
import { buildPackageEdgeDataExportEntries } from '../../src/server/services/package/packageEdgeDataExport.service';
import {
  VOTING_PACKAGE_ID,
  VOTING_PACKAGE_NAME,
  VOTING_PACKAGE_VERSION,
} from '../../src/core/packages/votingPackage';
import {
  VOTING_PACKAGE_VOCAB_CAPTURE,
  votingSchemaInstallPath,
  votingSchemaUninstallPath,
} from '../../src/core/packages/votingPackagePackRecipe';

const isVotingDraft = (folder: string, name: string, id: string): boolean => {
  const haystack = `${folder}/${name}/${id}`.replace(/\\/g, '/').toLowerCase();
  return haystack.includes('voting-') || haystack.includes('/voting/') || folder.trim().toLowerCase() === 'voting';
};

const isVoteObjectName = (objectName: string): boolean => objectName.trim().toLowerCase().startsWith('vote_');

async function main(): Promise<void> {
  const upload = process.argv.includes('--upload');
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('No data source is configured in settings.json.');
  }

  const edgeDbQuery = createEdgeDbQueryExecutor({
    getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
  });

  const schemaInstallPath = votingSchemaInstallPath(source.type);
  const schemaUninstallPath = votingSchemaUninstallPath(source.type);
  const schemaInstall = schemaInstallPath ? readCapturableSqlFile(schemaInstallPath) : null;
  const schemaUninstall = schemaUninstallPath ? readCapturableSqlFile(schemaUninstallPath) : null;

  const vocab = await captureSeedInserts(
    { edgeDbQuery, settingsPath: SETTINGS_PATH },
    {
      dataSourceId: source.id,
      tableName: VOTING_PACKAGE_VOCAB_CAPTURE.tableName,
      where: VOTING_PACKAGE_VOCAB_CAPTURE.where,
      parentColumn: VOTING_PACKAGE_VOCAB_CAPTURE.parentColumn,
      includeDescendants: VOTING_PACKAGE_VOCAB_CAPTURE.includeDescendants,
      includeBinary: VOTING_PACKAGE_VOCAB_CAPTURE.includeBinary,
      limit: 0,
    },
  );

  const installSql = joinCapturedSqlParts(
    schemaInstall?.ok ? schemaInstall.content : '',
    vocab.installSql,
  );
  const uninstallSql = joinCapturedSqlParts(
    schemaUninstall?.ok ? schemaUninstall.content : '',
    vocab.uninstallSql,
  );

  const pageSeeds = listDesignerDrafts()
    .filter((draft) => isVotingDraft(draft.folder, draft.name, draft.id))
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

  console.log(`Designer Voting pages: ${pageSeeds.length}`);

  const voteModels = listEdgeModels().filter((model) => isVoteObjectName(model.objectName));
  const voteModelIds = new Set(voteModels.map((model) => model.id));
  const voteApis = listEdgeApiDefinitions().filter((api) => voteModelIds.has(api.edgeModelId));

  const edgeExport = buildPackageEdgeDataExportEntries({
    edgeModelIds: voteModels.map((model) => model.id),
    edgeApiIds: voteApis.map((api) => api.id),
  });
  if ('ok' in edgeExport && edgeExport.ok === false) {
    throw new Error(edgeExport.error);
  }
  const edge = edgeExport as Exclude<typeof edgeExport, { ok: false }>;

  const uiRoutes = applyStudioRoutePatternsToUiRoutes(
    buildPackageUiRoutesForPageSeeds({ pageSeeds }),
    listRouteBindingFiles(),
  );
  const studioExtras = buildPackageStudioModuleExtras({
    packageName: VOTING_PACKAGE_NAME,
    routes: uiRoutes,
    pageSeeds,
  });

  const dbObjects = buildPackageBuilderDbObjects({
    packageId: VOTING_PACKAGE_ID,
    installSql,
    uninstallSql,
    includeInitialRecords: true,
    optionalInstallSql: '',
    optionalUninstallSql: '',
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

  for (const file of capturedHidRowsToArtifactFiles(vocab.hidRows)) {
    zip.addFile(file.entryName, Buffer.from(file.data));
  }
  if (studioExtras) {
    for (const file of studioModuleExtraFiles(studioExtras)) {
      addText(file.entry, file.content);
    }
  }

  const manifest = {
    $schemaVersion: '1.0',
    id: VOTING_PACKAGE_ID,
    name: VOTING_PACKAGE_NAME,
    version: VOTING_PACKAGE_VERSION,
    description: 'Voting & elections Studio module (vote_* schema, vocab, DATA_API edge, Designer pages).',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [],
      ui_components: [],
      ui_routes: uiRoutes,
      ...(studioExtras
        ? {
          navigation_patches: [studioExtras.navigationPatchCapability],
          culture_keys: [studioExtras.cultureKeysCapability],
        }
        : {}),
      db_objects: dbObjects,
      mcp_servers: [],
      ...(edge.capabilities.edge_models.length > 0 ? { edge_models: edge.capabilities.edge_models } : {}),
      ...(edge.capabilities.edge_apis.length > 0 ? { edge_apis: edge.capabilities.edge_apis } : {}),
      ...(edge.capabilities.edge_model_studio_meta.length > 0
        ? { edge_model_studio_meta: edge.capabilities.edge_model_studio_meta }
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
  const outPath = path.join(outDir, `${VOTING_PACKAGE_ID}-${VOTING_PACKAGE_VERSION}.zip`);
  zip.writeZip(outPath);
  console.log(`Wrote ${outPath} (${zip.getEntries().length} entries)`);

  if (upload) {
    const result = await uploadPackageArtifact(fs.readFileSync(outPath), path.basename(outPath), 'admin');
    if (!result.success) {
      throw new Error(result.error);
    }
    console.log(`Uploaded ${result.packageId}@${result.version}`);
  }
}

main().catch((error) => {
  console.error('[voting:pack]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
