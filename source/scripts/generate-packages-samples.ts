/**
 * Generates manual QA ZIP samples under plugins-samples/ (phase 1 — historical ecosystem ZIP plan).
 *
 * Usage: npm run packages:samples
 */
import fs from 'fs';
import path from 'path';
import {
  PHASE1_MANUAL_SAMPLE_CATALOG,
  PHASE1_MANUAL_SCENARIO_GUIDE,
  resolveManualSampleOutputPath,
  type ManualSampleEntry,
} from '../src/core/packages/testkit/manualSampleCatalog.js';

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeSampleZip(rootDir: string, entry: ManualSampleEntry): string {
  const outPath = resolveManualSampleOutputPath(rootDir, entry);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, entry.build());
  return outPath;
}

function buildReadmeEn(generatedAt: string): string {
  const lines: string[] = [
    '# plugins-samples — ecosystem manual QA (phase 1)',
    '',
    '> Auto-generated — `npm run packages:samples`',
    `> Last generated: ${generatedAt}`,
    '',
    '## Is this the right workflow?',
    '',
    '**Yes.** This folder is for manual testing: upload the ZIPs yourself in Admin UI and inspect the result.',
    'Automated CI tests live in `fixtures/` and vitest; this folder mirrors phase 1 scenarios with English guidance.',
    '',
    '## Prerequisites',
    '',
    '```bash',
    'npm run dev',
    '# optional — clean start:',
    'npm run package:purge',
    '```',
    '',
    '- **Plugins:** Admin Shell → Plugins page',
    '- **Themes:** Admin Shell → Themes page (`/themes`)',
    '- **API:** Browser or curl against `http://localhost:<port>/api/...`',
    '- **Deployment overlay:** `packages-storage/deployments/<packageId>.deployment-applied.json`',
    '',
    '## Folder structure',
    '',
    '| Folder | Contents |',
    '|--------|----------|',
    '| `themes/` | Valid theme (TH-01) |',
    '| `packages/` | Valid extensions |',
    '| `vertical-apps/` | Vertical App |',
    '| `negative/themes/` | Invalid themes — upload must fail |',
    '| `negative/packages/` | Invalid extensions — upload must fail |',
    '| `scenarios/` | JSON metadata per scenario |',
    '',
    '## In-ZIP guidance',
    '',
    'Each valid artifact includes:',
    '- `description` in `package.json` / theme README guidance',
    '- `MANUAL-QA.md` inside the ZIP with verification steps',
    '',
    '---',
    '',
    '## Phase 1 scenarios (17 scenarios)',
    '',
  ];

  for (const scenario of PHASE1_MANUAL_SCENARIO_GUIDE) {
    lines.push(`### ${scenario.id} — ${scenario.titleFa} (${scenario.priority})`);
    lines.push('');
    lines.push(`**Fixtures:** ${scenario.fixtureIds.join(', ')}`);
    lines.push('');
    lines.push('**Steps:**');
    for (const step of scenario.stepsFa) {
      lines.push(`1. ${step}`);
    }
    lines.push('');
    lines.push('**Success checks:**');
    for (const check of scenario.verifyFa) {
      lines.push(`- ${check}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Fixture index');
  lines.push('');
  lines.push('| ID | File | Upload | Scenarios |');
  lines.push('|----|------|--------|-----------|');
  for (const entry of PHASE1_MANUAL_SAMPLE_CATALOG) {
    const rel = path.relative('plugins-samples', resolveManualSampleOutputPath('plugins-samples', entry)).replace(/\\/g, '/');
    const upload = entry.expectedUpload ? '✅ success' : '❌ must reject';
    lines.push(`| ${entry.id} | \`${rel}\` | ${upload} | ${entry.scenarioIds.join(', ') || '—'} |`);
  }
  lines.push('');
  lines.push('## Regenerate');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run packages:samples');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function writeManifest(rootDir: string, generatedAt: string): void {
  const manifest = {
    schema: 'plugins-samples-phase1',
    schemaVersion: '1.0.0',
    generatedAt,
    spec: 'historical:p-ecosystem-zip-test-phase1',
    fixtureCount: PHASE1_MANUAL_SAMPLE_CATALOG.length,
    scenarioCount: PHASE1_MANUAL_SCENARIO_GUIDE.length,
    fixtures: PHASE1_MANUAL_SAMPLE_CATALOG.map((entry) => ({
      id: entry.id,
      fileName: entry.fileName,
      category: entry.category,
      negativeGroup: entry.negativeGroup ?? null,
      relativePath: path.relative(rootDir, resolveManualSampleOutputPath(rootDir, entry)).replace(/\\/g, '/'),
      scenarioIds: entry.scenarioIds,
      expectedUpload: entry.expectedUpload,
      manualQaFa: entry.manualQaFa,
    })),
    scenarios: PHASE1_MANUAL_SCENARIO_GUIDE,
  };

  fs.writeFileSync(path.join(rootDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  for (const scenario of PHASE1_MANUAL_SCENARIO_GUIDE) {
    const scenarioPath = path.join(rootDir, 'scenarios', `${scenario.id}.json`);
    ensureDir(path.dirname(scenarioPath));
    fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
  }
}

async function run(): Promise<void> {
  const rootDir = path.join(process.cwd(), 'plugins-samples');
  const generatedAt = new Date().toISOString();

  ensureDir(path.join(rootDir, 'themes'));
  ensureDir(path.join(rootDir, 'plugins'));
  ensureDir(path.join(rootDir, 'vertical-apps'));
  ensureDir(path.join(rootDir, 'negative', 'plugins'));
  ensureDir(path.join(rootDir, 'negative', 'themes'));
  ensureDir(path.join(rootDir, 'scenarios'));

  const written: string[] = [];
  for (const entry of PHASE1_MANUAL_SAMPLE_CATALOG) {
    const outPath = writeSampleZip(rootDir, entry);
    written.push(path.relative(process.cwd(), outPath).replace(/\\/g, '/'));
  }

  writeManifest(rootDir, generatedAt);
  fs.writeFileSync(path.join(rootDir, 'README.md'), `${buildReadmeEn(generatedAt)}\n`, 'utf8');

  console.log(`[packages:samples] wrote ${written.length} ZIP files to plugins-samples/`);
  console.log(`[packages:samples] README=plugins-samples/README.md`);
  console.log(`[packages:samples] scenarios=${PHASE1_MANUAL_SCENARIO_GUIDE.length} fixtures=${PHASE1_MANUAL_SAMPLE_CATALOG.length}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[packages:samples] fatal:', message);
  process.exitCode = 1;
});
