import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_DESIGNER_EN } from '../../../src/core/culture/translations/componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from '../../../src/core/culture/translations/componentDesignerPresetsEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const packsDir = path.join(root, 'src/core/system-extensions/culture-packs');

function loadJson(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
}

function loadOverlay(prefix: string): Record<string, string> {
  const merged: Record<string, string> = {};
  if (!fs.existsSync(dataDir)) return merged;
  for (const name of fs.readdirSync(dataDir).filter((n) => n.startsWith(prefix) && n.endsWith('.json')).sort()) {
    Object.assign(merged, loadJson(path.join(dataDir, name)));
  }
  return merged;
}

function finalize(
  cultureId: 'ir' | 'iq',
  outName: string,
  source: Record<string, string>,
  overlayPrefix: string,
): number {
  const outPath = path.join(packsDir, cultureId, outName);
  const partial = loadJson(outPath);
  const overlay = loadOverlay(overlayPrefix);
  const out: Record<string, string> = { ...partial };

  for (const key of Object.keys(source)) {
    const en = source[key]!;
    if (out[key] && out[key] !== en) continue;
    const translated = overlay[key]?.trim();
    if (!translated) {
      throw new Error(`Missing ${overlayPrefix} translation for ${key}`);
    }
    out[key] = translated;
  }

  if (Object.keys(out).length !== Object.keys(source).length) {
    throw new Error(`Key count mismatch for ${outPath}`);
  }

  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return Object.keys(out).length;
}

const irDesigner = finalize('ir', 'locale-componentDesigner.json', COMPONENT_DESIGNER_EN, 'fa-designer-');
const irPresets = finalize('ir', 'locale-componentDesignerPresets.json', COMPONENT_DESIGNER_PRESETS_EN, 'fa-presets-');
const iqDesigner = finalize('iq', 'locale-componentDesigner.json', COMPONENT_DESIGNER_EN, 'ar-designer-');
const iqPresets = finalize('iq', 'locale-componentDesignerPresets.json', COMPONENT_DESIGNER_PRESETS_EN, 'ar-presets-');

console.log(JSON.stringify({ irDesigner, irPresets, iqDesigner, iqPresets }, null, 2));
