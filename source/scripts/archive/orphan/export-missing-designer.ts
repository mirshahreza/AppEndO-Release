import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

function loadPartial(cultureId: 'ir' | 'iq', file: string): Record<string, string> {
  const p = path.join(packsDir, cultureId, file);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>;
}

function missingKeys(source: Record<string, string>, partial: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(source)) {
    const en = source[key]!;
    if (!partial[key] || partial[key] === en) {
      out[key] = en;
    }
  }
  return out;
}

function merge(source: Record<string, string>, partial: Record<string, string>, overlay: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...partial };
  for (const key of Object.keys(source)) {
    const en = source[key]!;
    if (out[key] && out[key] !== en) continue;
    const translated = overlay[key]?.trim();
    if (!translated) {
      throw new Error(`Missing overlay for ${key}`);
    }
    out[key] = translated;
  }
  return out;
}

const irDesignerPartial = loadPartial('ir', 'locale-componentDesigner.json');
const missingFaDesigner = missingKeys(COMPONENT_DESIGNER_EN, irDesignerPartial);
fs.writeFileSync(path.join(dir, 'missing-fa-designer-en.json'), JSON.stringify(missingFaDesigner, null, 2));

console.log('missing fa designer', Object.keys(missingFaDesigner).length);
console.log('partial ir designer', Object.keys(irDesignerPartial).length);
