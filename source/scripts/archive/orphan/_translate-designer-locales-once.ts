/**
 * One-off: translate component designer EN shards into ir/iq locale-*.json overlays.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

const PLACEHOLDER_RE = /\{[^}]+\}/g;
const batchSize = 12;
const delayMs = 2000;
const maxRetries = 5;

type Shard = { name: string; source: Record<string, string> };
const SHARDS: Shard[] = [
  { name: 'locale-componentDesigner.json', source: COMPONENT_DESIGNER_EN },
  { name: 'locale-componentDesignerPresets.json', source: COMPONENT_DESIGNER_PRESETS_EN },
];

const TARGETS = [
  { id: 'ir' as const, googleLang: 'fa' as const },
  { id: 'iq' as const, googleLang: 'ar' as const },
];

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
    out = out.replaceAll(`__PH_${index}__`, token);
  });
  return out;
}

async function translateBatch(texts: string[], targetLang: 'fa' | 'ar'): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }
  const joined = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url);
    if (response.status === 429) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Translate HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
      throw new Error('Unexpected translate payload shape');
    }
    const segments = payload[0] as Array<[string] | string>;
    const translatedJoined = segments.map((segment) => (Array.isArray(segment) ? segment[0] : segment)).join('');
    const lines = translatedJoined.split('\n');
    if (lines.length !== texts.length) {
      throw new Error(`Batch size mismatch: expected ${texts.length}, got ${lines.length}`);
    }
    return lines;
  }
  throw new Error('Translate rate limited after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  for (const target of TARGETS) {
    for (const shard of SHARDS) {
      const outPath = path.join(packsDir, target.id, shard.name);
      let translated: Record<string, string> = {};
      if (fs.existsSync(outPath)) {
        translated = JSON.parse(fs.readFileSync(outPath, 'utf8')) as Record<string, string>;
      }
      const keys = Object.keys(shard.source).sort();
      const pending = keys.filter((key) => !translated[key] || translated[key] === shard.source[key]);
      console.log(`[designer-locales] ${target.id} ${shard.name}: ${pending.length} pending of ${keys.length}`);

      for (let offset = 0; offset < pending.length; offset += batchSize) {
        const slice = pending.slice(offset, offset + batchSize);
        const englishTexts = slice.map((key) => shard.source[key]!);
        const protectedBatch = englishTexts.map((text) => protectPlaceholders(text));
        const maskedTexts = protectedBatch.map((entry) => entry.masked);
        const translatedMasked = await translateBatch(maskedTexts, target.googleLang);
        slice.forEach((key, index) => {
          translated[key] = restorePlaceholders(translatedMasked[index] ?? '', protectedBatch[index]?.tokens ?? []);
        });
        fs.writeFileSync(outPath, `${JSON.stringify(translated, null, 2)}\n`, 'utf8');
        console.log(
          `[designer-locales] ${target.id} ${shard.name}: ${Math.min(offset + batchSize, pending.length)}/${pending.length}`,
        );
        await sleep(delayMs);
      }

      for (const key of keys) {
        if (!translated[key]) {
          throw new Error(`Missing key after sync: ${key}`);
        }
      }
      console.log(`[designer-locales] wrote ${outPath} (${keys.length} keys)`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
