/**
 * Translate ir/locale-componentDesigner.json (fa) values to ar for iq overlay.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '@vitalets/google-translate-api';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const irPath = path.join(root, 'src/core/system-extensions/culture-packs/ir/locale-componentDesigner.json');
const outPath = path.join(root, 'src/core/system-extensions/culture-packs/iq/locale-componentDesigner.json');

const PLACEHOLDER_RE = /\{[^}]+\}/g;
const delayMs = 3500;

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

async function main(): Promise<void> {
  const fa = JSON.parse(fs.readFileSync(irPath, 'utf8')) as Record<string, string>;
  let out: Record<string, string> = {};
  if (fs.existsSync(outPath)) {
    out = JSON.parse(fs.readFileSync(outPath, 'utf8')) as Record<string, string>;
  }

  const keys = Object.keys(COMPONENT_DESIGNER_EN);
  for (const key of keys) {
    const sourceText = fa[key];
    if (!sourceText) {
      throw new Error(`Missing fa value for ${key}`);
    }
    if (out[key] && out[key] !== COMPONENT_DESIGNER_EN[key]) {
      continue;
    }
    const { masked, tokens } = protectPlaceholders(sourceText);
    let attempt = 0;
    while (attempt < 10) {
      try {
        const result = await translate(masked, { from: 'fa', to: 'ar' });
        out[key] = restorePlaceholders(result.text, tokens);
        break;
      } catch (error) {
        attempt++;
        console.warn(`retry ${key}`, attempt);
        await sleep(4000 * attempt);
      }
    }
    if (attempt >= 10) {
      throw new Error(`Failed ${key}`);
    }
    await sleep(delayMs);
    if (Object.keys(out).length % 25 === 0) {
      fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
      console.log(`${Object.keys(out).length}/${keys.length}`);
    }
  }

  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log('done', Object.keys(out).length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
