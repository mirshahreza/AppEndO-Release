#!/usr/bin/env tsx
/**
 * Minimal plugin package scaffold — outputs a contract-valid ZIP with manifest + placeholder files.
 *
 * Usage: npm run package:scaffold -- my-package-id
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildScaffoldPluginZip } from '../src/core/packages/testkit/packageZipBuilder';

const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;

const packageId = process.argv[2]?.trim();
if (!packageId || !PLUGIN_ID_RE.test(packageId)) {
  console.error('Usage: npm run package:scaffold -- <plugin-id>');
  console.error('Plugin id must match:', PLUGIN_ID_RE.source);
  process.exit(1);
}

const displayName = packageId
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const outDir = path.resolve(process.cwd(), 'dist-scaffold', packageId);
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'README.md'),
  `# ${displayName}\n\nScaffolded with \`npm run package:scaffold\`.\n\nUpload \`${packageId}.zip\` via Packages hub.\n`,
  'utf8',
);

const zipPath = path.resolve(process.cwd(), 'dist-scaffold', `${packageId}.zip`);
writeFileSync(zipPath, buildScaffoldPluginZip(packageId));

console.log(`Scaffold written: ${zipPath}`);
