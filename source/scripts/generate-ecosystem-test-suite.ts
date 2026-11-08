/**
 * Generates ecosystem test ZIP fixtures + manifest under fixtures/.
 * Optional --upload runs plugin upload smoke against generated artifacts.
 *
 * Spec: plans/core/todo/p-33-ecosystem-zip-test-phase2.md §5.1
 */
import fs from 'fs';
import path from 'path';
import {
  ECOSYSTEM_FIXTURE_CATALOG,
  ECOSYSTEM_SCENARIO_CATALOG,
  resolveFixtureOutputPath,
  type EcosystemFixtureEntry,
} from '../src/core/packages/testkit/ecosystemFixtureCatalog.js';
import { ensurePackageStorageDirs, PACKAGE_STORAGE_ROOT } from '../src/core/packages/PackageFileStore.js';
import { uploadPackageArtifact, type UploadArtifactResult } from '../src/core/packages/PackageArtifactService.js';

type UploadReport = {
  id: string;
  zipPath: string;
  expectedUpload: boolean;
  actualSuccess: boolean;
  kind: 'plugin';
  error?: string;
};

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetUploadSmokeStorage(): void {
  if (fs.existsSync(PACKAGE_STORAGE_ROOT)) {
    fs.rmSync(PACKAGE_STORAGE_ROOT, { recursive: true, force: true });
  }
  ensurePackageStorageDirs();
}

function writeFixtureZip(rootDir: string, entry: EcosystemFixtureEntry): string {
  const outPath = resolveFixtureOutputPath(rootDir, entry);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, entry.build());
  return outPath;
}

function writeManifest(rootDir: string, generatedAt: string): void {
  const manifest = {
    schema: 'ecosystem-fixture-catalog',
    schemaVersion: '1.0.0',
    generatedAt,
    fixtures: ECOSYSTEM_FIXTURE_CATALOG.map((entry) => ({
      id: entry.id,
      fileName: entry.fileName,
      category: entry.category,
      negativeGroup: entry.negativeGroup ?? null,
      relativePath: path.relative(rootDir, resolveFixtureOutputPath(rootDir, entry)).replace(/\\/g, '/'),
      scenarioIds: entry.scenarioIds,
      expectedUpload: entry.expectedUpload,
      uploadPrerequisite: entry.uploadPrerequisite ?? null,
      uploadAliasOf: entry.uploadAliasOf ?? null,
      uploadKind: entry.uploadKind ?? null,
    })),
    scenarios: ECOSYSTEM_SCENARIO_CATALOG,
    stats: {
      total: ECOSYSTEM_FIXTURE_CATALOG.length,
      themes: 0,
      plugins: ECOSYSTEM_FIXTURE_CATALOG.filter((item) => item.category === 'plugins').length,
      verticalApps: ECOSYSTEM_FIXTURE_CATALOG.filter((item) => item.category === 'vertical-apps').length,
      studioExport: ECOSYSTEM_FIXTURE_CATALOG.filter((item) => item.category === 'studio-export').length,
      negative: ECOSYSTEM_FIXTURE_CATALOG.filter((item) => item.category === 'negative').length,
    },
  };

  fs.writeFileSync(path.join(rootDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  for (const scenario of ECOSYSTEM_SCENARIO_CATALOG) {
    const scenarioPath = path.join(rootDir, 'scenarios', `${scenario.id}.json`);
    ensureDir(path.dirname(scenarioPath));
    fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
  }
}

async function runUploadSmoke(rootDir: string): Promise<UploadReport[]> {
  ensurePackageStorageDirs();
  const reports: UploadReport[] = [];
  const uploadedIds = new Set<string>();

  for (const entry of ECOSYSTEM_FIXTURE_CATALOG) {
    if (entry.uploadAliasOf && uploadedIds.has(entry.uploadAliasOf)) {
      reports.push({
        id: entry.id,
        zipPath: resolveFixtureOutputPath(rootDir, entry),
        expectedUpload: entry.expectedUpload,
        actualSuccess: true,
        kind: 'plugin',
      });
      uploadedIds.add(entry.id);
      continue;
    }

    if (entry.uploadPrerequisite && !uploadedIds.has(entry.uploadPrerequisite)) {
      const prerequisite = ECOSYSTEM_FIXTURE_CATALOG.find((item) => item.id === entry.uploadPrerequisite);
      if (prerequisite) {
        const prereqPath = resolveFixtureOutputPath(rootDir, prerequisite);
        const prereqBuffer = fs.readFileSync(prereqPath);
        const prereqName = prerequisite.originalName ?? prerequisite.fileName;
        await uploadPackageArtifact(prereqBuffer, prereqName, 'ecosystem-test-suite');
        uploadedIds.add(prerequisite.id);
      }
    }

    const zipPath = resolveFixtureOutputPath(rootDir, entry);
    const buffer = fs.readFileSync(zipPath);
    const originalName = entry.originalName ?? entry.fileName;

    const result: UploadArtifactResult = await uploadPackageArtifact(buffer, originalName, 'ecosystem-test-suite');
    reports.push({
      id: entry.id,
      zipPath,
      expectedUpload: entry.expectedUpload,
      actualSuccess: result.success,
      kind: 'plugin',
      error: result.success ? undefined : result.error,
    });
    uploadedIds.add(entry.id);
  }

  return reports;
}

function printUploadReport(report: UploadReport): void {
  const status = report.actualSuccess ? 'SUCCESS' : 'FAILED';
  const expected = report.expectedUpload ? 'SUCCESS' : 'FAILED';
  const mismatch = status === expected ? '' : ' (MISMATCH)';
  const err = report.error ? ` | ${report.error}` : '';
  console.log(`[upload] ${report.id} => ${status}, expected=${expected}${mismatch}${err}`);
}

async function run(): Promise<void> {
  const rootDir = path.join(process.cwd(), 'fixtures');
  const upload = process.argv.includes('--upload');
  const generatedAt = new Date().toISOString();

  ensureDir(path.join(rootDir, 'plugins'));
  ensureDir(path.join(rootDir, 'vertical-apps'));
  ensureDir(path.join(rootDir, 'negative', 'plugins'));
  ensureDir(path.join(rootDir, 'negative', 'vertical-apps'));
  ensureDir(path.join(rootDir, 'scenarios'));
  ensureDir(path.join(rootDir, 'studio-export'));

  const written: string[] = [];
  for (const entry of ECOSYSTEM_FIXTURE_CATALOG) {
    const outPath = writeFixtureZip(rootDir, entry);
    written.push(path.relative(process.cwd(), outPath).replace(/\\/g, '/'));
  }

  writeManifest(rootDir, generatedAt);

  const readme = [
    '# Ecosystem test fixtures',
    '',
    'Generated by `npm run ecosystem:test-suite`. Do not hand-edit ZIP artifacts.',
    '',
    `- Generated at: ${generatedAt}`,
    `- Fixture count: ${ECOSYSTEM_FIXTURE_CATALOG.length}`,
    `- Catalog: manifest.json`,
    `- Scenario metadata: scenarios/SC-*.json`,
    '',
    'Regenerate:',
    '',
    '```bash',
    'npm run ecosystem:test-suite',
    'npm run ecosystem:test-suite -- --upload',
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(rootDir, 'README.md'), `${readme}\n`, 'utf8');

  console.log(`[ecosystem:test-suite] wrote ${written.length} ZIP files to fixtures/`);
  console.log(`[ecosystem:test-suite] manifest=fixtures/manifest.json`);

  let uploadReports: UploadReport[] = [];
  if (upload) {
    resetUploadSmokeStorage();
    uploadReports = await runUploadSmoke(rootDir);
    for (const report of uploadReports) {
      printUploadReport(report);
    }

    const mismatches = uploadReports.filter((item) => item.expectedUpload !== item.actualSuccess);
    const reportPath = path.join(rootDir, 'upload-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ generatedAt, uploads: uploadReports, mismatches: mismatches.map((item) => item.id) }, null, 2),
      'utf8',
    );
    console.log(`[ecosystem:test-suite] upload-report=fixtures/upload-report.json mismatches=${mismatches.length}`);
    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[ecosystem:test-suite] fatal:', message);
  process.exitCode = 1;
});
