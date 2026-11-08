#!/usr/bin/env tsx
/**
 * Builds official reference extension packages for p-08 / p-12 quality gates.
 *
 * Usage: npm run package:reference-build
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  REFERENCE_PACKAGE_SPECS,
  REFERENCE_UI_ROUTE_PACKAGE_SPEC,
  buildPackageZipBuffer,
} from '../src/core/packages/testkit/packageZipBuilder';

const ALL_REFERENCE_SPECS = [...REFERENCE_PACKAGE_SPECS, REFERENCE_UI_ROUTE_PACKAGE_SPEC];

const outputDir = path.resolve(process.cwd(), 'runtime/package-test-fixtures/reference');
mkdirSync(outputDir, { recursive: true });

for (const spec of ALL_REFERENCE_SPECS) {
  const zipPath = path.join(outputDir, `${spec.packageId}-${spec.version}.zip`);
  writeFileSync(zipPath, buildPackageZipBuffer(spec));
  console.log(`Reference package: ${path.relative(process.cwd(), zipPath)}`);
}
