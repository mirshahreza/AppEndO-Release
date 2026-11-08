import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_FORMS_EN } from '../src/core/culture/translations/settingsFormsEn';
import { SETTINGS_EXTENDED_EN } from '../src/core/culture/translations/settingsExtendedEn';
import { APPENDOO_EN } from '../src/core/culture/translations/appendooEn';
import { PAGE_GUIDE_EN } from '../src/core/culture/translations/pageGuideEn';
import { SERVER_FUNCTIONS_UI_EN } from '../src/core/culture/translations/serverFunctionsUiEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

const SHARDS: Array<{ file: string; en: Record<string, string> }> = [
  { file: 'locale-settingsForms.json', en: SETTINGS_FORMS_EN },
  { file: 'locale-settingsExtended.json', en: SETTINGS_EXTENDED_EN },
  { file: 'locale-appendoo.json', en: APPENDOO_EN },
  { file: 'locale-pageGuide.json', en: PAGE_GUIDE_EN },
  { file: 'locale-serverFunctions.json', en: SERVER_FUNCTIONS_UI_EN },
];

const PLACEHOLDER_RE = /\{[^}]+\}/g;

function placeholders(s: string): string[] {
  return [...s.matchAll(PLACEHOLDER_RE)].map((m) => m[0]).sort();
}

let failed = false;
for (const { file, en } of SHARDS) {
  for (const pack of ['ir', 'iq'] as const) {
    const p = path.join(packsDir, pack, file);
    if (!fs.existsSync(p)) {
      console.error(`MISSING ${pack}/${file}`);
      failed = true;
      continue;
    }
    const loc = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>;
    const enKeys = Object.keys(en).sort();
    const locKeys = Object.keys(loc).sort();
    if (enKeys.join() !== locKeys.join()) {
      const missing = enKeys.filter((k) => !loc[k]);
      const extra = locKeys.filter((k) => !en[k]);
      console.error(`${pack}/${file}: key mismatch missing=${missing.length} extra=${extra.length}`);
      if (missing.length) console.error('  missing:', missing.slice(0, 5).join(', '));
      failed = true;
    }
    for (const key of enKeys) {
      const enPh = placeholders(en[key]).join();
      const locPh = placeholders(loc[key] ?? '').join();
      if (enPh !== locPh) {
        console.error(`${pack}/${file} ${key}: placeholder mismatch en=${enPh} loc=${locPh}`);
        failed = true;
      }
      if (!loc[key]?.trim()) {
        console.error(`${pack}/${file} ${key}: empty`);
        failed = true;
      }
    }
  }
}
if (failed) process.exit(1);
console.log('All locale shards OK');
