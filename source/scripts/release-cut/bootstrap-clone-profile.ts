#!/usr/bin/env tsx
/**
 * Materialize settings.json for a release-cut clone line (OSS or package deploy).
 * Run from monorepo root, clone repo root, or clone source/ (auto-detect).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { RELEASE_CUT_CLONE_PROFILES, cloneProfileFor } from './releaseCutCloneProfiles';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');

function parseArgs(argv: string[]): { profile: ReleaseCutCloneProfileId; database?: string; force: boolean } {
  let profile: ReleaseCutCloneProfileId | undefined;
  let database: string | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile' && argv[i + 1]) {
      profile = argv[i + 1] as ReleaseCutCloneProfileId;
      i += 1;
    } else if (arg === '--database' && argv[i + 1]) {
      database = argv[i + 1];
      i += 1;
    } else if (arg === '--force') {
      force = true;
    }
  }

  if (!profile || !RELEASE_CUT_CLONE_PROFILES[profile]) {
    const ids = Object.keys(RELEASE_CUT_CLONE_PROFILES).join(', ');
    throw new Error(`Usage: clone:bootstrap -- --profile <${ids}> [--database Name] [--force]`);
  }

  return { profile, database, force };
}

function resolveSourceRoot(cwd: string): string {
  const recommended = path.join(cwd, 'settings.recommended.json');
  if (fs.existsSync(recommended)) return cwd;

  const nested = path.join(cwd, 'source', 'settings.recommended.json');
  if (fs.existsSync(nested)) return path.join(cwd, 'source');

  if (fs.existsSync(path.join(cwd, 'package.json')) && fs.existsSync(TEMPLATES_DIR)) {
    return cwd;
  }

  throw new Error(
    'Could not find settings.recommended.json — run from clone source/, clone root, or AppEndO monorepo',
  );
}

function applyDatabaseOverride(settings: Record<string, unknown>, databaseName: string, port: number): void {
  const db = settings.database as Record<string, unknown> | undefined;
  if (db && typeof db.url === 'string') {
    db.url = db.url.replace(/database=[^;]+/i, `database=${databaseName}`);
  }
  const sources = settings.dataSources as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(sources) && sources[0]) {
    sources[0].database = databaseName;
  }
  const runtime = settings.runtime as Record<string, unknown> | undefined;
  if (runtime) {
    runtime.port = port;
    runtime.appUrl = `http://localhost:${port}`;
  }
}

function main(): void {
  const { profile: profileId, database, force } = parseArgs(process.argv.slice(2));
  const profile = cloneProfileFor(profileId);
  const sourceRoot = resolveSourceRoot(process.cwd());

  const recommendedPath = path.join(sourceRoot, 'settings.recommended.json');
  const settingsPath = path.join(sourceRoot, 'settings.json');

  if (fs.existsSync(settingsPath) && !force) {
    throw new Error(
      `${settingsPath} already exists — use --force to overwrite or remove it manually`,
    );
  }

  const templatePath = path.join(TEMPLATES_DIR, profile.settingsRecommendedTemplate);
  let body: string;
  if (fs.existsSync(recommendedPath)) {
    body = fs.readFileSync(recommendedPath, 'utf8');
  } else if (fs.existsSync(templatePath)) {
    body = fs.readFileSync(templatePath, 'utf8');
  } else {
    throw new Error(`Missing ${recommendedPath} and template ${templatePath}`);
  }

  const parsed = JSON.parse(body) as Record<string, unknown>;
  const dbName = database ?? profile.recommendedControlPlaneDatabase;
  applyDatabaseOverride(parsed, dbName, profile.recommendedDevPort);

  fs.writeFileSync(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${settingsPath} (profile=${profileId}, database=${dbName})`);
  console.log(`Next: cd ${sourceRoot} && npm install && npm run dev`);
  console.log(`See CLONE_PROFILE.md in the same folder for package-specific steps.`);
}

main();
