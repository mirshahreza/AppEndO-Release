import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const ar: Record<string, string> = {};
for (const name of fs.readdirSync(dir).filter((n) => n.startsWith('ar-designer-chunk') && n.endsWith('.json'))) {
  Object.assign(ar, JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as Record<string, string>);
}
const missing = Object.keys(COMPONENT_DESIGNER_EN).filter((k) => !ar[k]);
console.log(missing.join('\n'));
