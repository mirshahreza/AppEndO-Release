/**
 * Merge EN keys with fa/ar overlay shards and write locale-*.json under ir/ and iq/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');

type LocaleId = 'fa' | 'ar';

function loadShards(locale: LocaleId, shardBase: string): Record<string, string> {
  const merged: Record<string, string> = {};
  const prefix = `${locale}-${shardBase}`;
  if (!fs.existsSync(dataDir)) {
    return merged;
  }
  const files = fs
    .readdirSync(dataDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort();
  for (const file of files) {
    Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) as Record<string, string>);
  }
  return merged;
}

function buildOverlay(
  source: Record<string, string>,
  locale: LocaleId,
  shardBase: string,
): Record<string, string> {
  const overlay = loadShards(locale, shardBase);
  const out: Record<string, string> = {};
  for (const key of Object.keys(source)) {
    const value = overlay[key]?.trim();
    if (!value) {
      throw new Error(`Missing ${locale} translation for ${key}`);
    }
    out[key] = value;
  }
  return out;
}

function writePack(localeId: 'ir' | 'iq', locale: LocaleId, outName: string, source: Record<string, string>, shardBase: string): void {
  const shardBaseName = outName.replace(/^locale-/, '').replace(/\.json$/, '');
  const overlay = buildOverlay(source, locale, shardBaseName);
  const outPath = path.join(packsDir, localeId, outName);
  fs.writeFileSync(outPath, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
  console.log(`${outPath}: ${Object.keys(overlay).length} keys`);
}

writePack('ir', 'fa', 'locale-componentDesigner.json', COMPONENT_DESIGNER_EN, 'componentDesigner');
writePack('ir', 'fa', 'locale-componentDesignerPresets.json', COMPONENT_DESIGNER_PRESETS_EN, 'componentDesignerPresets');
writePack('iq', 'ar', 'locale-componentDesigner.json', COMPONENT_DESIGNER_EN, 'componentDesigner');
writePack('iq', 'ar', 'locale-componentDesignerPresets.json', COMPONENT_DESIGNER_PRESETS_EN, 'componentDesignerPresets');
