import fs from 'node:fs';
import path from 'node:path';
import { buildAssetsAttributionManifest } from '../src/shared/lib/assetsAttribution';

const outputPath = path.resolve(process.cwd(), 'public', 'legal', 'assets-attribution.json');
const manifest = buildAssetsAttributionManifest();

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Wrote ${path.relative(process.cwd(), outputPath)} (${manifest.entries.length} entries)`);
