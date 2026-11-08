import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';

/**
 * Builds fa/ar overlay JSON from paired locale files when present.
 * Expects manual fa-designer-chunk*.json and ar-designer-part*.json in designer-locale-data.
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');

function loadPrefix(prefix: string): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const name of fs.readdirSync(dir).filter((n) => n.startsWith(prefix) && n.endsWith('.json'))) {
    Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as Record<string, string>);
  }
  return merged;
}

const fa = loadPrefix('fa-designer-');
const ar = loadPrefix('ar-designer-');
console.log('fa overlay keys', Object.keys(fa).length);
console.log('ar overlay keys', Object.keys(ar).length);
console.log('en designer keys', Object.keys(COMPONENT_DESIGNER_EN).length);

const missingFa = Object.keys(COMPONENT_DESIGNER_EN).filter((k) => !fa[k]);
const missingAr = Object.keys(COMPONENT_DESIGNER_EN).filter((k) => !ar[k]);
if (missingFa.length) console.log('missing fa sample', missingFa.slice(0, 5));
if (missingAr.length) console.log('missing ar count', missingAr.length);
