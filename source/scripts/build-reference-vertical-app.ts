#!/usr/bin/env tsx
/**
 * Builds the official reference vertical-app artifact for p-14 quality gate.
 *
 * Usage: npm run package:reference-vertical-build
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
  REFERENCE_INVENTORY_VERTICAL_APP_SPEC,
  buildVerticalAppZipBuffer,
} from '../src/core/packages/testkit/verticalAppPackageBuilder';
import { validateVerticalAppManifest } from '../src/core/packages/verticalAppManifestValidator';

const spec = REFERENCE_INVENTORY_VERTICAL_APP_SPEC;
const outputDir = path.resolve(process.cwd(), 'runtime/package-test-fixtures/vertical-apps/inventory');
mkdirSync(outputDir, { recursive: true });

const zipBuffer = buildVerticalAppZipBuffer(spec);
const zipPath = path.join(outputDir, `${spec.packageId}-${spec.version}.zip`);
writeFileSync(zipPath, zipBuffer);

const manifest = JSON.parse(new AdmZip(zipBuffer).readAsText('package.json'));
const validation = validateVerticalAppManifest(manifest);
if (!validation.valid) {
  console.error('Generated manifest failed validation:', validation.errors);
  process.exit(1);
}

console.log(`Reference vertical-app: ${path.relative(process.cwd(), zipPath)}`);
console.log(`Manifest hash: ${manifest.integrity.artifactHash}`);
