import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { validateVerticalAppManifest } from './verticalAppManifestValidator';
import { buildHawietyVerticalAppPackageSpec } from './hawietyPackagePackRecipe';
import { buildVerticalAppManifest, buildVerticalAppZipBuffer } from './testkit/verticalAppPackageBuilder';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function hawietyPackageZipFileName(version?: string): string {
  const spec = buildHawietyVerticalAppPackageSpec();
  return `${spec.packageId}-${version ?? spec.version}.zip`;
}

export async function buildHawietyPackageZipBuffer(): Promise<Buffer> {
  const { precompileHawietyUiPages } = await import('../../../scripts/hawiety-pack/precompileHawietyUiPages');
  const precompiledUiFiles = await precompileHawietyUiPages();
  return buildVerticalAppZipBuffer(
    buildHawietyVerticalAppPackageSpec({
      uiPackaging: 'prebuilt-bundle',
      precompiledUiFiles,
    }),
  );
}

/** Writes zip to disk and returns absolute path (for install scripts). */
export async function writeHawietyPackageZip(outputDir?: string): Promise<string> {
  const buffer = await buildHawietyPackageZipBuffer();
  const spec = buildHawietyVerticalAppPackageSpec();
  const dir = outputDir ?? path.join(repoRoot, 'runtime/package-artifacts/hawiety');
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, hawietyPackageZipFileName(spec.version));
  fs.writeFileSync(zipPath, buffer);
  return zipPath;
}

export function assertHawietyPackageManifestValid(): void {
  const manifest = buildVerticalAppManifest(buildHawietyVerticalAppPackageSpec());
  const validation = validateVerticalAppManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Hawiety package manifest invalid: ${validation.errors.join(' ')}`);
  }
}
