/**
 * Machine-translate master EN keys into ir (fa) and iq (ar) locale JSON overlays.
 * Preserves `{placeholder}` tokens and ALWAYS_ENGLISH keys.
 *
 * Usage:
 *   npx tsx scripts/sync-culture-pack-locales.ts
 *   npx tsx scripts/sync-culture-pack-locales.ts --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_TRANSLATION_MASTER_EN, listMasterTranslationKeys } from '../src/core/culture/translations/masterEn';
import { ALWAYS_ENGLISH_TRANSLATION_KEYS } from '../src/core/culture/technicalCultureLabels';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

const PLACEHOLDER_RE = /\{[^}]+\}/g;

type Target = { id: 'ir' | 'iq'; googleLang: 'fa' | 'ar'; outFile: string };

const TARGETS: Target[] = [
  { id: 'ir', googleLang: 'fa', outFile: path.join(packsDir, 'ir', 'locale.json') },
  { id: 'iq', googleLang: 'ar', outFile: path.join(packsDir, 'iq', 'locale.json') },
];

const dryRun = process.argv.includes('--dry-run');
const batchSize = 40;
const delayMs = 250;

function protectPlaceholders(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(PLACEHOLDER_RE, (match) => {
    const token = `__PH_${tokens.length}__`;
    tokens.push(match);
    return token;
  });
  return { masked, tokens };
}

function restorePlaceholders(text: string, tokens: string[]): string {
  let out = text;
  tokens.forEach((token, index) => {
    out = out.replace(`__PH_${index}__`, token);
  });
  return out;
}

async function translateBatch(texts: string[], targetLang: 'fa' | 'ar'): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  const joined = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translate HTTP ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('Unexpected translate payload shape');
  }

  const segments = payload[0] as Array<[string] | string>;
  const translatedJoined = segments
    .map((segment) => (Array.isArray(segment) ? segment[0] : segment))
    .join('');

  return translatedJoined.split('\n');
}

function loadExisting(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncTarget(target: Target): Promise<void> {
  const existing = loadExisting(target.outFile);
  const keys = listMasterTranslationKeys();
  const pending: string[] = [];

  for (const key of keys) {
    const english = BUILTIN_TRANSLATION_MASTER_EN[key];
    if (!english) {
      continue;
    }
    if (ALWAYS_ENGLISH_TRANSLATION_KEYS.has(key)) {
      existing[key] = english;
      continue;
    }
    if (existing[key] && existing[key] !== english) {
      continue;
    }
    if (existing[key] === english) {
      pending.push(key);
      continue;
    }
    pending.push(key);
  }

  console.log(`[sync-culture-pack-locales] ${target.id}: ${pending.length} keys to translate (${keys.length} total)`);

  if (dryRun || pending.length === 0) {
    return;
  }

  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const slice = pending.slice(offset, offset + batchSize);
    const englishTexts = slice.map((key) => BUILTIN_TRANSLATION_MASTER_EN[key]);
    const protectedBatch = englishTexts.map((text) => protectPlaceholders(text));
    const maskedTexts = protectedBatch.map((entry) => entry.masked);

    let translatedMasked: string[];
    try {
      translatedMasked = await translateBatch(maskedTexts, target.googleLang);
    } catch (error) {
      console.error(`[sync-culture-pack-locales] batch failed at offset ${offset}:`, error);
      throw error;
    }

    if (translatedMasked.length !== slice.length) {
      throw new Error(`Batch size mismatch: expected ${slice.length}, got ${translatedMasked.length}`);
    }

    slice.forEach((key, index) => {
      const restored = restorePlaceholders(translatedMasked[index] ?? '', protectedBatch[index]?.tokens ?? []);
      existing[key] = restored;
    });

    fs.writeFileSync(target.outFile, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    console.log(`[sync-culture-pack-locales] ${target.id}: ${Math.min(offset + batchSize, pending.length)}/${pending.length}`);
    await sleep(delayMs);
  }
}

async function main(): Promise<void> {
  for (const target of TARGETS) {
    await syncTarget(target);
  }
  console.log('[sync-culture-pack-locales] done');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
