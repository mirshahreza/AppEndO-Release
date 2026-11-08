/**
 * Rebuild cms@1.2.3 from the last packed ZIP when live CMS tables are gone
 * (post-uninstall). Cleans IDENTITY_INSERT artifacts leaked into markdown bodies.
 *
 *   npx tsx scripts/cms-phase1/repack-cms-seed-from-zip.ts --upload
 */
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../../src/core/packages/packageArtifactHash';
import { uploadPackageArtifact } from '../../src/core/packages/PackageArtifactService';
import { validateManifest } from '../../src/core/packages/PackageManifestValidator';
import { stripAccidentalIdentityInsertArtifacts } from '../../src/core/packages/packageDbScriptSql';

const SOURCE_ZIP = path.join(process.cwd(), 'packages-storage', 'tmp', 'cms-1.2.2.zip');
const NEXT_VERSION = '1.2.3';
const SEED_ENTRY = 'db/seed/optional-records.sql';

async function main(): Promise<void> {
  const upload = process.argv.includes('--upload');
  if (!fs.existsSync(SOURCE_ZIP)) {
    throw new Error(`Missing ${SOURCE_ZIP}`);
  }

  const zip = new AdmZip(SOURCE_ZIP);
  const seed = zip.readAsText(SEED_ENTRY);
  const cleaned = stripAccidentalIdentityInsertArtifacts(seed);
  if (cleaned === seed) {
    console.warn('Seed SQL had no IDENTITY_INSERT artifacts to strip.');
  } else {
    console.log('Stripped leaked SET IDENTITY_INSERT lines from optional seed SQL.');
  }
  zip.updateFile(SEED_ENTRY, Buffer.from(cleaned.endsWith('\n') ? cleaned : `${cleaned}\n`, 'utf8'));

  const manifest = JSON.parse(zip.readAsText('package.json')) as {
    version: string;
    integrity: { algorithm: string; artifactHash: string };
  };
  manifest.version = NEXT_VERSION;
  manifest.integrity.artifactHash = '0'.repeat(64);
  zip.updateFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  manifest.integrity.artifactHash = computePackageArtifactHashFromZip(zip);
  zip.updateFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

  const validated = validateManifest(JSON.parse(zip.readAsText('package.json')));
  if (!validated.valid) {
    throw new Error(`Manifest invalid:\n${(validated.errors ?? []).join('\n')}`);
  }

  const outPath = path.join(process.cwd(), 'packages-storage', 'tmp', `cms-${NEXT_VERSION}.zip`);
  zip.writeZip(outPath);
  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);

  if (upload) {
    const result = await uploadPackageArtifact(fs.readFileSync(outPath), path.basename(outPath), 'admin');
    if (!result.success) {
      throw new Error(result.error + (result.details?.length ? `\n${result.details.join('\n')}` : ''));
    }
    console.log(`Uploaded ${result.packageId}@${result.version}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
