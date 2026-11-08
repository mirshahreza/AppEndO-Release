/**
 * Translate designer EN shards to fa/ar overlay JSON using @vitalets/google-translate-api.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '@vitalets/google-translate-api';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

const PLACEHOLDER_RE = /\{[^}]+\}/g;
const delayMs = 4500;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateRecord(
  source: Record<string, string>,
  to: 'fa' | 'ar',
  outPath: string,
): Promise<number> {
  let existing: Record<string, string> = {};
  if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) as Record<string, string>;
  }

  const keys = Object.keys(source);
  let done = 0;
  for (const key of keys) {
    const english = source[key]!;
    if (existing[key] && existing[key] !== english) {
      done++;
      continue;
    }
    const { masked, tokens } = protectPlaceholders(english);
    let attempt = 0;
    while (attempt < 12) {
      try {
        const result = await translate(masked, { to, from: 'en' });
        existing[key] = restorePlaceholders(result.text, tokens);
        done++;
        if (done % 25 === 0) {
          fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
          console.log(`${path.basename(outPath)}: ${done}/${keys.length}`);
        }
        await sleep(delayMs);
        break;
      } catch (error) {
        attempt++;
        console.warn(`retry ${key} attempt ${attempt}`, error);
        await sleep(5000 * attempt);
      }
    }
    if (attempt >= 6) {
      throw new Error(`Failed to translate ${key}`);
    }
  }

  fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  if (Object.keys(existing).length !== keys.length) {
    throw new Error(`Key mismatch for ${outPath}`);
  }
  return keys.length;
}

async function main(): Promise<void> {
  const jobs: Array<{ out: string; source: Record<string, string>; to: 'fa' | 'ar' }> = [
    {
      out: path.join(packsDir, 'ir', 'locale-componentDesigner.json'),
      source: COMPONENT_DESIGNER_EN,
      to: 'fa',
    },
    {
      out: path.join(packsDir, 'ir', 'locale-componentDesignerPresets.json'),
      source: COMPONENT_DESIGNER_PRESETS_EN,
      to: 'fa',
    },
    {
      out: path.join(packsDir, 'iq', 'locale-componentDesigner.json'),
      source: COMPONENT_DESIGNER_EN,
      to: 'ar',
    },
    {
      out: path.join(packsDir, 'iq', 'locale-componentDesignerPresets.json'),
      source: COMPONENT_DESIGNER_PRESETS_EN,
      to: 'ar',
    },
  ];

  for (const job of jobs) {
    const count = await translateRecord(job.source, job.to, job.out);
    console.log(`wrote ${job.out} (${count} keys)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
