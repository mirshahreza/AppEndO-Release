import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const outPath = path.join(root, 'src/core/system-extensions/culture-packs/iq/locale-componentDesigner.json');

function loadPrefix(prefix: string): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const name of fs.readdirSync(dataDir).filter((n) => n.startsWith(prefix) && n.endsWith('.json')).sort()) {
    Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')) as Record<string, string>);
  }
  return merged;
}

const overlay = loadPrefix('ar-designer-');
const out: Record<string, string> = {};
for (const key of Object.keys(COMPONENT_DESIGNER_EN)) {
  const translated = overlay[key]?.trim();
  if (!translated) {
    throw new Error(`Missing ar-designer for ${key}`);
  }
  out[key] = translated;
}

fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log('iq designer', Object.keys(out).length);
