import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  uploadPackageArtifact,
  type UploadArtifactResult,
} from '../src/core/packages/PackageArtifactService.js';
import {
  ensurePackageStorageDirs,
  packageDirs,
  appendPackageEvent,
} from '../src/core/packages/PackageFileStore.js';
import type { DependencyGraph } from '../src/core/packages/DependencyResolver.js';
import type { PackageLifecycleResult } from '../src/server/domain/package-domain/types.js';
import { getDefaultPackageLifecycleCoordinator } from '../src/server/services/package-runtime/packageLifecycle.service.js';

type ManifestDependency = { packageId: string; versionRange: string };

type ScenarioCapability = {
  apis?: Array<{
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    entry: string;
  }>;
  ui_components?: Array<{
    componentKey: string;
    slotId: string;
    entry: string;
    order?: number;
  }>;
  db_objects?: Array<{
    objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
    objectName: string;
    installScript: string;
    uninstallScript?: string;
    seedScript?: string;
    targetDataSource?: string;
  }>;
};

type Scenario = {
  key: string;
  fileName: string;
  packageId?: string;
  packageVersion?: string;
  buildManifest?: boolean;
  includeUnknownTopLevelField?: boolean;
  invalidIntegrityFormat?: boolean;
  originalNameForUpload?: string;
  expectedUploadSuccess: boolean;
  dependencies?: ManifestDependency[];
  capabilities?: ScenarioCapability;
  overridePolicy?: {
    apis: 'allow' | 'deny';
    ui_components: 'allow' | 'deny';
    db_objects: 'allow' | 'deny';
  };
  extraEntries?: Array<{ entryPath: string; content: string }>;
};

type UploadReport = {
  key: string;
  zipPath: string;
  expectedSuccess: boolean;
  actualSuccess: boolean;
  result: UploadArtifactResult;
};

type LifecycleReport = {
  step: string;
  result: PackageLifecycleResult | DependencyGraph;
};

function makeRunTag(): string {
  const raw = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(2, 14);
  return `zrun${raw}`;
}

function makeManifestInput(
  packageId: string,
  version: string,
  dependencies: ManifestDependency[] | undefined,
  capabilities: ScenarioCapability | undefined,
  overridePolicy: Scenario['overridePolicy'] | undefined,
  includeUnknownTopLevelField: boolean,
  invalidIntegrityFormat: boolean,
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Plugin ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    dependencies: dependencies ?? [],
    capabilities: {
      apis: capabilities?.apis ?? [],
      ui_components: capabilities?.ui_components ?? [],
      db_objects: capabilities?.db_objects ?? [],
    },
    overridePolicy: overridePolicy ?? {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: invalidIntegrityFormat ? 'bad-hash' : '0'.repeat(64),
    },
  };

  if (includeUnknownTopLevelField) {
    manifest.unexpected = true;
  }

  return manifest;
}

function buildZipBuffer(scenario: Scenario): Buffer {
  const zip = new AdmZip();

  if (scenario.buildManifest !== false) {
    if (!scenario.packageId || !scenario.packageVersion) {
      throw new Error(`Scenario ${scenario.key} requires packageId and packageVersion.`);
    }

    const manifest = makeManifestInput(
      scenario.packageId,
      scenario.packageVersion,
      scenario.dependencies,
      scenario.capabilities,
      scenario.overridePolicy,
      Boolean(scenario.includeUnknownTopLevelField),
      Boolean(scenario.invalidIntegrityFormat),
    );

    zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

    for (const api of scenario.capabilities?.apis ?? []) {
      zip.addFile(api.entry, Buffer.from(`export default async () => ({ ok: true, route: '${api.path}' });\n`, 'utf8'));
    }

    for (const ui of scenario.capabilities?.ui_components ?? []) {
      zip.addFile(ui.entry, Buffer.from(`export default function ${ui.componentKey.replace(/[^A-Za-z0-9_]/g, '_')}(){ return null; }\n`, 'utf8'));
    }

    for (const db of scenario.capabilities?.db_objects ?? []) {
      zip.addFile(db.installScript, Buffer.from(`-- install ${db.objectName}\nSELECT 1;\n`, 'utf8'));
      if (db.uninstallScript) {
        zip.addFile(db.uninstallScript, Buffer.from(`-- uninstall ${db.objectName}\nSELECT 1;\n`, 'utf8'));
      }
      if (db.seedScript) {
        zip.addFile(db.seedScript, Buffer.from(`-- seed ${db.objectName}\nSELECT 1;\n`, 'utf8'));
      }
    }
  }

  for (const entry of scenario.extraEntries ?? []) {
    zip.addFile(entry.entryPath, Buffer.from(entry.content, 'utf8'));
  }

  return zip.toBuffer();
}

function printUploadResult(item: UploadReport): void {
  const status = item.actualSuccess ? 'SUCCESS' : 'FAILED';
  const expected = item.expectedSuccess ? 'SUCCESS' : 'FAILED';
  const mismatch = expected === status ? '' : ' (EXPECTATION_MISMATCH)';
  const err = item.result.success ? '' : ` | error=${(item.result as Extract<UploadArtifactResult, { success: false }>).error}`;
  console.log(`[upload] ${item.key} => ${status}, expected=${expected}${mismatch}${err}`);
}

function printLifecycleResult(item: LifecycleReport): void {
  if ('schema' in item.result) {
    const graph = item.result;
    console.log(`[lifecycle] ${item.step} => graph nodes=${graph.nodes.length} edges=${graph.edges.length} hasCycle=${graph.hasCycle}`);
    return;
  }

  if (item.result.success) {
    console.log(`[lifecycle] ${item.step} => SUCCESS (${item.result.operation}) plugin=${item.result.packageId} version=${item.result.version}`);
  } else {
    const failure = item.result as Extract<PackageLifecycleResult, { success: false }>;
    console.log(`[lifecycle] ${item.step} => FAILED (${failure.operation}) code=${failure.code} error=${failure.error}`);
  }
}

function runLifecycleWithRetry(step: string, op: () => PackageLifecycleResult): PackageLifecycleResult {
  const first = op();
  if (first.success) return first;

  const failure = first as Extract<PackageLifecycleResult, { success: false }>;
  const isTransientFsRenameError =
    failure.code === 'internal_error' &&
    /EPERM|operation not permitted|rename/i.test(failure.error);

  if (!isTransientFsRenameError) return first;

  const second = op();
  if (!second.success) {
    const secondFailure = second as Extract<PackageLifecycleResult, { success: false }>;
    console.log(`[lifecycle] ${step} retry => FAILED code=${secondFailure.code} error=${secondFailure.error}`);
  } else {
    console.log(`[lifecycle] ${step} retry => SUCCESS`);
  }
  return second;
}

async function run(): Promise<void> {
  ensurePackageStorageDirs();
  const lifecycle = getDefaultPackageLifecycleCoordinator();

  const runTag = makeRunTag();
  const actor = 'plugin-test-suite-script';
  const outputDir = path.join(packageDirs.tmp, `plugin-test-suite-${runTag}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const ids = {
    api: `${runTag}-api`,
    ui: `${runTag}-ui`,
    dbSafe: `${runTag}-db-safe`,
    dbUnsafe: `${runTag}-db-unsafe`,
    depBase: `${runTag}-dep-base`,
    depAddon: `${runTag}-dep-addon`,
    conflictOwner: `${runTag}-conf-owner`,
    conflictDeny: `${runTag}-conf-deny`,
    conflictAllow: `${runTag}-conf-allow`,
    badUnknownKey: `${runTag}-bad-unknown`,
    badEmptyCaps: `${runTag}-bad-emptycaps`,
    badId: '1badid',
    badIntegrity: `${runTag}-bad-integrity`,
    missingDep: `${runTag}-missing-dep`,
  };
  const runToken = runTag.replace(/-/g, '');
  const sharedConflictPath = `/packages/${runTag}/shared/ping`;

  const scenarios: Scenario[] = [
    {
      key: 'valid-api-only',
      fileName: `${ids.api}-1.0.0.zip`,
      packageId: ids.api,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        apis: [
          {
            id: 'health',
            method: 'GET',
            path: `/packages/${ids.api}/health`,
            entry: 'api/health.ts',
          },
        ],
      },
    },
    {
      key: 'valid-ui-only',
      fileName: `${ids.ui}-1.0.0.zip`,
      packageId: ids.ui,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        ui_components: [
          {
            componentKey: `statusCard${runToken}`,
            slotId: 'core.dashboard.widgets',
            entry: 'ui/status-card.tsx',
            order: 10,
          },
        ],
      },
    },
    {
      key: 'valid-db-safe',
      fileName: `${ids.dbSafe}-1.0.0.zip`,
      packageId: ids.dbSafe,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        db_objects: [
          {
            objectType: 'table',
            objectName: `${runTag.replace(/-/g, '_')}_audit_tbl`,
            installScript: 'db/install/audit_tbl.sql',
            uninstallScript: 'db/uninstall/audit_tbl.sql',
            seedScript: 'db/seed/audit_tbl.sql',
          },
        ],
      },
    },
    {
      key: 'valid-db-unsafe-install-path',
      fileName: `${ids.dbUnsafe}-1.0.0.zip`,
      packageId: ids.dbUnsafe,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        db_objects: [
          {
            objectType: 'table',
            objectName: `${runTag.replace(/-/g, '_')}_unsafe_tbl`,
            installScript: 'scripts/install/unsafe_tbl.sql',
          },
        ],
      },
    },
    {
      key: 'valid-dependency-base',
      fileName: `${ids.depBase}-1.0.0.zip`,
      packageId: ids.depBase,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        apis: [
          {
            id: 'base',
            method: 'GET',
            path: `/packages/${ids.depBase}/base`,
            entry: 'api/base.ts',
          },
        ],
      },
    },
    {
      key: 'valid-dependency-addon',
      fileName: `${ids.depAddon}-1.0.0.zip`,
      packageId: ids.depAddon,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      dependencies: [{ packageId: ids.depBase, versionRange: '>=1.0.0' }],
      capabilities: {
        ui_components: [
          {
            componentKey: 'addonWidget',
            slotId: 'core.dashboard.widgets',
            entry: 'ui/addon-widget.tsx',
          },
        ],
      },
    },
    {
      key: 'valid-conflict-owner',
      fileName: `${ids.conflictOwner}-1.0.0.zip`,
      packageId: ids.conflictOwner,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        apis: [
          {
            id: 'shared',
            method: 'GET',
            path: sharedConflictPath,
            entry: 'api/shared-owner.ts',
          },
        ],
      },
    },
    {
      key: 'valid-conflict-deny',
      fileName: `${ids.conflictDeny}-1.0.0.zip`,
      packageId: ids.conflictDeny,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        apis: [
          {
            id: 'shared2',
            method: 'GET',
            path: sharedConflictPath,
            entry: 'api/shared-deny.ts',
          },
        ],
      },
      overridePolicy: {
        apis: 'deny',
        ui_components: 'deny',
        db_objects: 'deny',
      },
    },
    {
      key: 'valid-conflict-allow',
      fileName: `${ids.conflictAllow}-1.0.0.zip`,
      packageId: ids.conflictAllow,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      capabilities: {
        apis: [
          {
            id: 'shared3',
            method: 'GET',
            path: sharedConflictPath,
            entry: 'api/shared-allow.ts',
          },
        ],
      },
      overridePolicy: {
        apis: 'allow',
        ui_components: 'deny',
        db_objects: 'deny',
      },
    },
    {
      key: 'invalid-unknown-top-level-field',
      fileName: `${ids.badUnknownKey}-1.0.0.zip`,
      packageId: ids.badUnknownKey,
      packageVersion: '1.0.0',
      expectedUploadSuccess: false,
      includeUnknownTopLevelField: true,
      capabilities: {
        apis: [
          {
            id: 'badmeta',
            method: 'GET',
            path: `/packages/${ids.badUnknownKey}/badmeta`,
            entry: 'api/badmeta.ts',
          },
        ],
      },
    },
    {
      key: 'invalid-empty-capabilities',
      fileName: `${ids.badEmptyCaps}-1.0.0.zip`,
      packageId: ids.badEmptyCaps,
      packageVersion: '1.0.0',
      expectedUploadSuccess: false,
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
      },
    },
    {
      key: 'invalid-plugin-id-format',
      fileName: 'invalid-id-format-1.0.0.zip',
      packageId: ids.badId,
      packageVersion: '1.0.0',
      expectedUploadSuccess: false,
      capabilities: {
        apis: [
          {
            id: 'badid',
            method: 'GET',
            path: '/packages/bad-id/health',
            entry: 'api/bad-id.ts',
          },
        ],
      },
    },
    {
      key: 'invalid-integrity-format',
      fileName: `${ids.badIntegrity}-1.0.0.zip`,
      packageId: ids.badIntegrity,
      packageVersion: '1.0.0',
      expectedUploadSuccess: false,
      invalidIntegrityFormat: true,
      capabilities: {
        apis: [
          {
            id: 'hash',
            method: 'GET',
            path: `/packages/${ids.badIntegrity}/hash`,
            entry: 'api/hash.ts',
          },
        ],
      },
    },
    {
      key: 'invalid-missing-package-json',
      fileName: `${runTag}-missing-package-json.zip`,
      buildManifest: false,
      expectedUploadSuccess: false,
      extraEntries: [
        { entryPath: 'api/no-manifest.ts', content: 'export default () => ({ ok: true });\n' },
      ],
    },
    {
      key: 'invalid-zip-slip-entry',
      fileName: `${runTag}-zip-slip.zip`,
      buildManifest: false,
      expectedUploadSuccess: false,
      extraEntries: [
        { entryPath: 'package.json', content: '{"$schemaVersion":"1.0"}\n' },
        { entryPath: '../escape.txt', content: 'unsafe\n' },
      ],
    },
    {
      key: 'invalid-non-zip-extension',
      fileName: `${runTag}-non-zip.bin`,
      packageId: `${runTag}-nonzip`,
      packageVersion: '1.0.0',
      originalNameForUpload: `${runTag}-non-zip.bin`,
      expectedUploadSuccess: false,
      capabilities: {
        apis: [
          {
            id: 'nonzip',
            method: 'GET',
            path: `/packages/${runTag}-nonzip/nonzip`,
            entry: 'api/nonzip.ts',
          },
        ],
      },
    },
    {
      key: 'valid-missing-dependency-plugin',
      fileName: `${ids.missingDep}-1.0.0.zip`,
      packageId: ids.missingDep,
      packageVersion: '1.0.0',
      expectedUploadSuccess: true,
      dependencies: [{ packageId: `${runTag}-ghost`, versionRange: '>=1.0.0' }],
      capabilities: {
        apis: [
          {
            id: 'missingdep',
            method: 'GET',
            path: `/packages/${ids.missingDep}/missingdep`,
            entry: 'api/missingdep.ts',
          },
        ],
      },
    },
  ];

  const uploadReports: UploadReport[] = [];

  for (const scenario of scenarios) {
    const zipBuffer = buildZipBuffer(scenario);
    const zipPath = path.join(outputDir, scenario.fileName);
    fs.writeFileSync(zipPath, zipBuffer);

    const originalName = scenario.originalNameForUpload || scenario.fileName;
    const result = await uploadPackageArtifact(zipBuffer, originalName, actor);
    const report: UploadReport = {
      key: scenario.key,
      zipPath,
      expectedSuccess: scenario.expectedUploadSuccess,
      actualSuccess: result.success,
      result,
    };
    uploadReports.push(report);
    printUploadResult(report);
  }

  // Duplicate upload check for same packageId+version
  const dupScenario = scenarios.find((item) => item.key === 'valid-api-only');
  if (dupScenario) {
    const dupPath = path.join(outputDir, dupScenario.fileName);
    const dupBuffer = fs.readFileSync(dupPath);
    const dupResult = await uploadPackageArtifact(dupBuffer, dupScenario.fileName, actor);
    const duplicateReport: UploadReport = {
      key: 'invalid-duplicate-version-upload',
      zipPath: dupPath,
      expectedSuccess: false,
      actualSuccess: dupResult.success,
      result: dupResult,
    };
    uploadReports.push(duplicateReport);
    printUploadResult(duplicateReport);
  }

  const lifecycleReports: LifecycleReport[] = [];
  const pushLifecycle = (step: string, result: PackageLifecycleResult | DependencyGraph) => {
    const item: LifecycleReport = { step, result };
    lifecycleReports.push(item);
    printLifecycleResult(item);
  };

  pushLifecycle('install.valid-api-only', runLifecycleWithRetry('install.valid-api-only', () => lifecycle.install(ids.api, actor)));
  pushLifecycle('reinstall.valid-api-only', runLifecycleWithRetry('reinstall.valid-api-only', () => lifecycle.reinstall(ids.api, actor)));
  pushLifecycle('install.valid-ui-only', runLifecycleWithRetry('install.valid-ui-only', () => lifecycle.install(ids.ui, actor)));
  pushLifecycle('install.valid-db-safe', runLifecycleWithRetry('install.valid-db-safe', () => lifecycle.install(ids.dbSafe, actor)));
  pushLifecycle('install.valid-db-unsafe-install-path', runLifecycleWithRetry('install.valid-db-unsafe-install-path', () => lifecycle.install(ids.dbUnsafe, actor)));

  pushLifecycle('install.dep-addon-before-base', runLifecycleWithRetry('install.dep-addon-before-base', () => lifecycle.install(ids.depAddon, actor)));
  pushLifecycle('install.dep-base', runLifecycleWithRetry('install.dep-base', () => lifecycle.install(ids.depBase, actor)));
  pushLifecycle('install.dep-addon-after-base', runLifecycleWithRetry('install.dep-addon-after-base', () => lifecycle.install(ids.depAddon, actor)));
  pushLifecycle('uninstall.dep-base-while-required', runLifecycleWithRetry('uninstall.dep-base-while-required', () => lifecycle.uninstall(ids.depBase, actor)));
  pushLifecycle('uninstall.dep-addon', runLifecycleWithRetry('uninstall.dep-addon', () => lifecycle.uninstall(ids.depAddon, actor)));
  pushLifecycle('uninstall.dep-base', runLifecycleWithRetry('uninstall.dep-base', () => lifecycle.uninstall(ids.depBase, actor)));

  pushLifecycle('install.conflict-owner', runLifecycleWithRetry('install.conflict-owner', () => lifecycle.install(ids.conflictOwner, actor)));
  pushLifecycle('install.conflict-deny', runLifecycleWithRetry('install.conflict-deny', () => lifecycle.install(ids.conflictDeny, actor)));
  pushLifecycle(
    'install.conflict-allow-with-override',
    runLifecycleWithRetry('install.conflict-allow-with-override', () => lifecycle.install(ids.conflictAllow, actor, {
      overridePolicy: {
        apis: 'allow',
        ui_components: 'deny',
        db_objects: 'deny',
      },
    })),
  );

  pushLifecycle('install.missing-dependency', runLifecycleWithRetry('install.missing-dependency', () => lifecycle.install(ids.missingDep, actor)));
  pushLifecycle('dependency-graph', lifecycle.getDependencyGraph());

  const uploadMismatches = uploadReports.filter((item) => item.expectedSuccess !== item.actualSuccess);

  const summary = {
    runTag,
    generatedAt: new Date().toISOString(),
    outputDir,
    uploads: {
      total: uploadReports.length,
      success: uploadReports.filter((item) => item.actualSuccess).length,
      failed: uploadReports.filter((item) => !item.actualSuccess).length,
      mismatches: uploadMismatches.map((item) => item.key),
    },
    lifecycleSteps: lifecycleReports.length,
  };

  const reportPath = path.join(outputDir, 'report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        summary,
        uploads: uploadReports,
        lifecycle: lifecycleReports,
      },
      null,
      2,
    ),
    'utf8',
  );

  const readmePath = path.join(outputDir, 'README.txt');
  const readmeLines = [
    `Plugin test suite run: ${runTag}`,
    `Generated at: ${summary.generatedAt}`,
    '',
    'This folder contains generated ZIP plugin artifacts used for success/failure coverage.',
    `Detailed results: ${path.relative(process.cwd(), reportPath)}`,
    '',
    'Uploaded-to-system scenarios are recorded in packages-storage/index.json and related plugin storage folders.',
  ];
  fs.writeFileSync(readmePath, `${readmeLines.join('\n')}\n`, 'utf8');

  appendPackageEvent({
    type: 'plugin.test_suite.generated',
    actor,
    payload: {
      runTag,
      outputDir: path.relative(process.cwd(), outputDir),
      uploadTotal: summary.uploads.total,
      uploadMismatches: summary.uploads.mismatches,
      lifecycleSteps: summary.lifecycleSteps,
    },
  });

  console.log('');
  console.log(`[summary] runTag=${runTag}`);
  console.log(`[summary] outputDir=${path.relative(process.cwd(), outputDir)}`);
  console.log(`[summary] uploads total=${summary.uploads.total} success=${summary.uploads.success} failed=${summary.uploads.failed}`);
  if (summary.uploads.mismatches.length > 0) {
    console.log(`[summary] expectation mismatches=${summary.uploads.mismatches.join(', ')}`);
  } else {
    console.log('[summary] expectation mismatches=none');
  }
  console.log(`[summary] report=${path.relative(process.cwd(), reportPath)}`);
}

run().catch((error: any) => {
  console.error('[plugin-test-suite] fatal error:', error?.message || error);
  process.exitCode = 1;
});
