import fs from 'node:fs';
import path from 'node:path';
import { HAWIETY_CORE_UI_PAGE_EXPORTS } from '../../core/packages/hawietyPackagePackRecipe';
import { HWY_CANDIDATE_PIPELINE_STAGES } from '../../domain/hwy/hwyCandidatePipelineCatalog';
import { OPERATOR_PAGE_EDIT_LOCK_POLICY } from '../../config/operatorPageEditLocks';
import type { FeatureGraph } from './aiIndexCodegen';
import type { PageEditLockManifest, PageEditLockManifestEntry } from './operatorPageEditLock';
import { buildManifestEntryFromGraphNode } from './operatorPageEditLock';

const HAWIETY_SHARED_ROOTS = [
  'src/server/domain/hwy',
  'src/domain/hwy',
  'src/server/routes/hwy.routes.ts',
  'scripts/hwy-phase1',
  'scripts/hwy-etl',
  'scripts/hwy-phase3',
];

function modulePathToFeatureRoot(modulePath: string): string | null {
  const match = modulePath.match(/^@\/features\/([^/]+)\//);
  if (!match) return null;
  return `src/features/${match[1]}`;
}

function readRouteBindingPageKeys(rootDir: string): Array<{ pageKey: string; routePattern: string }> {
  const dir = path.join(rootDir, 'workspace/platform-registry/route-bindings');
  if (!fs.existsSync(dir)) return [];

  const entries: Array<{ pageKey: string; routePattern: string }> = [];
  for (const fileName of fs.readdirSync(dir)) {
    if (!fileName.endsWith('.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(dir, fileName), 'utf8')) as {
      pageKey?: string;
      routePattern?: string;
    };
    if (!raw.pageKey || !raw.routePattern) continue;
    entries.push({ pageKey: raw.pageKey, routePattern: raw.routePattern });
  }
  return entries;
}

function mergeEntry(
  map: Map<string, PageEditLockManifestEntry>,
  entry: PageEditLockManifestEntry,
): void {
  const existing = map.get(entry.pageKey);
  if (!existing) {
    map.set(entry.pageKey, entry);
    return;
  }
  const searchRoots = [...new Set([...existing.searchRoots, ...entry.searchRoots])];
  map.set(entry.pageKey, {
    ...existing,
    label: existing.label || entry.label,
    routePattern: existing.routePattern ?? entry.routePattern,
    searchRoots,
  });
}

export function buildPageEditLockManifest(rootDir: string, graph: FeatureGraph): PageEditLockManifest {
  const byKey = new Map<string, PageEditLockManifestEntry>();

  for (const node of graph.nodes) {
    mergeEntry(byKey, buildManifestEntryFromGraphNode(node));
  }

  for (const page of HAWIETY_CORE_UI_PAGE_EXPORTS) {
    const roots: string[] = [];
    const featureRoot = modulePathToFeatureRoot(page.modulePath);
    if (featureRoot) roots.push(featureRoot);
    mergeEntry(byKey, {
      pageKey: page.pageKey,
      label: page.title,
      routePattern: null,
      searchRoots: roots,
      source: 'package-ui',
    });
  }

  for (const stage of HWY_CANDIDATE_PIPELINE_STAGES) {
    mergeEntry(byKey, {
      pageKey: stage.pageKey,
      label: stage.legacyTitleAr,
      routePattern: stage.segment,
      searchRoots: ['src/features/hwy-geo-responsibility'],
      source: 'package-ui',
    });
  }

  for (const binding of readRouteBindingPageKeys(rootDir)) {
    const existing = byKey.get(binding.pageKey);
    const isHwy = binding.pageKey.startsWith('hwy-');
    const searchRoots = existing?.searchRoots.length
      ? existing.searchRoots
      : isHwy
        ? [...HAWIETY_SHARED_ROOTS]
        : [];

    mergeEntry(byKey, {
      pageKey: binding.pageKey,
      label: existing?.label ?? binding.pageKey,
      routePattern: binding.routePattern,
      searchRoots,
      source: existing?.source ?? 'route-binding',
    });
  }

  const pages = [...byKey.values()].sort((a, b) => a.pageKey.localeCompare(b.pageKey));

  return {
    version: graph.version,
    generatedAt: new Date().toISOString(),
    policy: OPERATOR_PAGE_EDIT_LOCK_POLICY,
    pageCount: pages.length,
    pages,
  };
}

export function writePageEditLockManifest(rootDir: string, graph: FeatureGraph): PageEditLockManifest {
  const manifest = buildPageEditLockManifest(rootDir, graph);
  const outPath = path.join(rootDir, 'docs/ai/page-edit-locks.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function loadPageEditLockManifest(rootDir = process.cwd()): PageEditLockManifest {
  const filePath = path.join(rootDir, 'docs/ai/page-edit-locks.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PageEditLockManifest;
}

/** Hawiety package pages that share server/domain code — used in cursor feature rules. */
export function hawietyPageLockRuleGlobs(pageKey: string, featureRoot: string | null): string[] {
  const globs = featureRoot ? [`${featureRoot}/**`] : [];
  if (pageKey.startsWith('hwy-')) {
    for (const root of HAWIETY_SHARED_ROOTS) {
      if (root.endsWith('.ts')) {
        globs.push(root);
      } else {
        globs.push(`${root}/**`);
      }
    }
  }
  return [...new Set(globs)];
}

export function resolvePackagePageFeatureRoot(pageKey: string): string | null {
  const fromExport = HAWIETY_CORE_UI_PAGE_EXPORTS.find((p) => p.pageKey === pageKey);
  if (fromExport) return modulePathToFeatureRoot(fromExport.modulePath);
  if (pageKey.startsWith('hwy-geo-responsibility-candidate-')) {
    return 'src/features/hwy-geo-responsibility';
  }
  if (pageKey.startsWith('hwy-members') || pageKey.startsWith('hwy-nakhebin')) {
    return 'src/features/hwy-members';
  }
  if (pageKey.startsWith('hwy-institutes')) {
    return 'src/features/hwy-institutes';
  }
  return null;
}

export function buildHawietyCursorPageLockRules(
  rootDir: string,
  graph: FeatureGraph,
): Array<{ pageKey: string; mdc: string }> {
  const manifest = buildPageEditLockManifest(rootDir, graph);
  const hwyPages = manifest.pages.filter((p) => p.pageKey.startsWith('hwy-'));
  const written: Array<{ pageKey: string; mdc: string }> = [];

  for (const page of hwyPages) {
    const featureRoot = resolvePackagePageFeatureRoot(page.pageKey);
    const globs = hawietyPageLockRuleGlobs(page.pageKey, featureRoot);
    if (globs.length === 0) continue;

    const fileName = `feature-${page.pageKey}.mdc`;
    const lines = [
      '---',
      `description: ${page.label} (Hawiety) — page edit lock`,
      'globs:',
      ...globs.map((g) => `  - ${g}`),
      'alwaysApply: false',
      '---',
      '',
      `# ${page.label} (\`pageKey: ${page.pageKey}\`)`,
      '',
      `- **Edit lock:** locked until the operator prompt explicitly names \`${page.pageKey}\`${page.routePattern ? `, route \`${page.routePattern}\`,` : ','} or this page.`,
      '- **Unlock:** operator names the page in the current prompt — not implied by nearby work.',
      '- **Manifest:** `docs/ai/page-edit-locks.json` · policy `all-locked` in `src/config/operatorPageEditLocks.ts`',
      '',
    ];
    written.push({ pageKey: page.pageKey, mdc: `${lines.join('\n')}` });
  }

  return written;
}

export function writeHawietyCursorPageLockRules(rootDir: string, graph: FeatureGraph): string[] {
  const rulesDir = path.join(rootDir, '.cursor/rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  const rules = buildHawietyCursorPageLockRules(rootDir, graph);
  const written: string[] = [];
  for (const rule of rules) {
    const fileName = `feature-${rule.pageKey}.mdc`;
    fs.writeFileSync(path.join(rulesDir, fileName), rule.mdc, 'utf8');
    written.push(fileName);
  }
  return written.sort((a, b) => a.localeCompare(b));
}
