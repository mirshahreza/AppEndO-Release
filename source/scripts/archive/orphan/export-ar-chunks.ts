import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const keys = Object.keys(COMPONENT_DESIGNER_EN);
for (let i = 0; i < 4; i++) {
  const slice = keys.slice(Math.floor((i * keys.length) / 4), Math.floor(((i + 1) * keys.length) / 4));
  const part: Record<string, string> = {};
  for (const key of slice) {
    part[key] = COMPONENT_DESIGNER_EN[key]!;
  }
  fs.writeFileSync(path.join(dir, `ar-chunk${i + 1}-en.json`), JSON.stringify(part, null, 2));
}
fs.writeFileSync(path.join(dir, 'presets-en.json'), JSON.stringify(COMPONENT_DESIGNER_PRESETS_EN, null, 2));
console.log('done', keys.length);
