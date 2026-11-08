/**
 * Report culture-pack locale overlay coverage vs master EN.
 * Usage: npx tsx scripts/culture-pack-locale-coverage.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_TRANSLATION_MASTER_EN, listMasterTranslationKeys } from '../src/core/culture/translations/masterEn';
import { ALWAYS_ENGLISH_TRANSLATION_KEYS } from '../src/core/culture/technicalCultureLabels';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

function loadOverlays(packId: 'ir' | 'iq'): Record<string, string> {
  const dir = path.join(packsDir, packId);
  const merged: Record<string, string> = {};
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('locale') && name.endsWith('.json')) {
      Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as Record<string, string>);
    }
  }
  return merged;
}

for (const packId of ['ir', 'iq'] as const) {
  const overlay = loadOverlays(packId);
  let localized = 0;
  let stillEnglish = 0;
  let missingOverlay = 0;
  const englishSamples: string[] = [];

  for (const key of listMasterTranslationKeys()) {
    if (ALWAYS_ENGLISH_TRANSLATION_KEYS.has(key)) {
      localized += 1;
      continue;
    }
    const value = overlay[key];
    if (!value) {
      missingOverlay += 1;
      if (englishSamples.length < 15) {
        englishSamples.push(key);
      }
      continue;
    }
    if (value === BUILTIN_TRANSLATION_MASTER_EN[key]) {
      stillEnglish += 1;
      if (englishSamples.length < 15) {
        englishSamples.push(key);
      }
    } else {
      localized += 1;
    }
  }

  console.log(`[culture-pack-locale-coverage] ${packId}:`, {
    masterKeys: listMasterTranslationKeys().length,
    overlayKeys: Object.keys(overlay).length,
    localized,
    stillEnglish,
    missingOverlay,
    sampleGaps: englishSamples,
  });
}
