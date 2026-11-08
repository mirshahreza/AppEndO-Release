/**
 * Sync culture pack bundle.ts files with BUILTIN_TRANSLATION_MASTER_EN.
 * `us` stays English; `ir` / `iq` merge optional locale.json overlays (see sync-culture-pack-locales.ts).
 *
 * Usage: npm run codegen:culture-bundles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_TRANSLATION_MASTER_EN, listMasterTranslationKeys } from '../src/core/culture/translations/masterEn';
import { ALWAYS_ENGLISH_TRANSLATION_KEYS } from '../src/core/culture/technicalCultureLabels';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

function readLocaleOverlay(packId: 'ir' | 'iq'): Record<string, string> {
  const packDir = path.join(packsDir, packId);
  const merged: Record<string, string> = {};

  const candidates = ['locale.json', ...fs.readdirSync(packDir).filter((name) => /^locale-.+\.json$/.test(name))];
  for (const name of candidates) {
    const localePath = path.join(packDir, name);
    if (!fs.existsSync(localePath)) {
      continue;
    }
    try {
      Object.assign(merged, JSON.parse(fs.readFileSync(localePath, 'utf8')) as Record<string, string>);
    } catch {
      console.warn(`[codegen:culture-bundles] Failed to parse ${localePath}`);
    }
  }

  return merged;
}

function mergeLocalizedBundle(packId: 'us' | 'ir' | 'iq'): Record<string, string> {
  if (packId === 'us') {
    return { ...BUILTIN_TRANSLATION_MASTER_EN };
  }

  const overlay = readLocaleOverlay(packId);
  const merged: Record<string, string> = { ...BUILTIN_TRANSLATION_MASTER_EN };

  for (const key of listMasterTranslationKeys()) {
    if (ALWAYS_ENGLISH_TRANSLATION_KEYS.has(key)) {
      merged[key] = BUILTIN_TRANSLATION_MASTER_EN[key];
      continue;
    }
    const localized = overlay[key]?.trim();
    if (localized) {
      merged[key] = localized;
    }
  }

  return merged;
}

function writeBundleFile(filePath: string, bundle: Record<string, string>): void {
  const keys = listMasterTranslationKeys();
  const lines = keys.map((key) => `  '${key}': ${JSON.stringify(bundle[key] ?? BUILTIN_TRANSLATION_MASTER_EN[key])},`);
  const contents = `const bundle: Record<string, string> = {\n${lines.join('\n')}\n};\n\nexport default bundle;\n`;
  fs.writeFileSync(filePath, contents, 'utf8');
}

const packIds: Array<'us' | 'ir' | 'iq'> = ['us', 'ir', 'iq'];

for (const id of packIds) {
  const bundlePath = path.join(packsDir, id, 'bundle.ts');
  writeBundleFile(bundlePath, mergeLocalizedBundle(id));
  console.log(`[codegen:culture-bundles] ${id}/bundle.ts — ${listMasterTranslationKeys().length} keys`);
}
