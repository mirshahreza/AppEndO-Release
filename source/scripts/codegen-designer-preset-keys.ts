import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'src/domain/component-designer/layout-presets/newLayoutPresets.tsx'),
  'utf8',
);

const presetBlockPattern =
  /\{\s*\n\s*id: '([^']+)',\s*\n\s*title: '((?:\\'|[^'])*)',\s*\n\s*description: '((?:\\'|[^'])*)',/g;

const allBlocks = [...src.matchAll(presetBlockPattern)];
const wizard = allBlocks.slice(0, 4);
const presets = allBlocks.slice(4);

const statusBlock = src.match(/export const NEW_LAYOUT_STATUS_MESSAGE[^=]+=\s*\{([\s\S]*?)\n\};/);
const statusEntries = statusBlock
  ? [...statusBlock[1].matchAll(/(?:'([^']+)'|(\w+)):\s*'((?:\\'|[^'])*)'/g)].map((match) => [
    match[1] ?? match[2] ?? '',
    match[3] ?? '',
  ] as const)
  : [];

const categoryBlock = src.match(/export const NEW_LAYOUT_CATEGORY_OPTIONS[^=]+=\s*\[([\s\S]*?)\];/);
const cats = categoryBlock
  ? [...categoryBlock[1].matchAll(/\{ value: '(\w+)', label: '([^']+)' \}/g)]
  : [];

const seenPresetIds = new Set<string>();
const lines: string[] = ['export const COMPONENT_DESIGNER_PRESETS_EN: Record<string, string> = {'];

for (const [, id, title, desc] of presets) {
  if (seenPresetIds.has(id)) continue;
  seenPresetIds.add(id);
  lines.push(`  'designer.presets.${id}.title': ${JSON.stringify(title)},`);
  lines.push(`  'designer.presets.${id}.description': ${JSON.stringify(desc)},`);
}
for (const [, id, title, desc] of wizard) {
  lines.push(`  'designer.wizard.${id}.title': ${JSON.stringify(title)},`);
  lines.push(`  'designer.wizard.${id}.description': ${JSON.stringify(desc)},`);
}
for (const [id, msg] of statusEntries) {
  lines.push(`  'designer.presets.${id}.status': ${JSON.stringify(msg)},`);
}
for (const [, value, label] of cats) {
  lines.push(`  'designer.presets.category.${value}': ${JSON.stringify(label)},`);
}

lines.push('};');
lines.push('');

const outPath = path.join(root, 'src/core/culture/translations/componentDesignerPresetsEn.ts');
fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`[codegen:designer-preset-keys] presets=${seenPresetIds.size} wizard=${wizard.length} status=${statusEntries.length} categories=${cats.length}`);
