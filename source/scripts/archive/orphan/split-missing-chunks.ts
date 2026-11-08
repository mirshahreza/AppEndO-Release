import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const missing = JSON.parse(fs.readFileSync(path.join(dir, 'missing-fa-designer-en.json'), 'utf8')) as Record<string, string>;
const keys = Object.keys(missing);
for (let i = 0; i < 4; i++) {
  const slice = keys.slice(Math.floor((i * keys.length) / 4), Math.floor(((i + 1) * keys.length) / 4));
  const part: Record<string, string> = {};
  for (const key of slice) {
    part[key] = missing[key]!;
  }
  fs.writeFileSync(path.join(dir, `chunk${i + 1}-en.json`), JSON.stringify(part, null, 2));
  console.log(`chunk${i + 1}`, slice.length);
}
