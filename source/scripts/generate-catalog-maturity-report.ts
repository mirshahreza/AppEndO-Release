/**
 * T1-7 — Write catalog-maturity-report.json from buildToolboxInventoryMatrix().
 *
 * Usage: npx tsx scripts/generate-catalog-maturity-report.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogMaturityReport } from '../src/domain/component-designer/toolboxInventory.ts';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(rootDir, 'docs', 'refactor-spec', 'catalog-maturity-report.json');

const report = buildCatalogMaturityReport();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`[catalog-maturity] wrote ${outPath}`);
console.log(
  `[catalog-maturity] total=${report.summary.total}`
  + ` have=${report.summary.have}`
  + ` partial=${report.summary.partial}`
  + ` missing=${report.summary.missing}`
  + ` haveAndEventComplete=${report.summary.haveAndEventComplete}`
  + ` remainingGaps=${report.remainingGaps.length}`
  + ` bindingGaps=${report.bindingGaps.length}`,
);
console.log(
  `[catalog-maturity] binding none=${report.summary.binding.none}`
  + ` parityTested=${report.summary.binding.parityTested}`
  + ` partial=${report.summary.binding.partial}`
  + ` broken=${report.summary.binding.broken}`,
);

if (report.remainingGaps.length > 0) {
  console.log('[catalog-maturity] remaining gaps:');
  for (const gap of report.remainingGaps) {
    console.log(`  - ${gap.paletteItemId}: ${gap.reasons.join(', ')}`);
  }
}

if (report.bindingGaps.length > 0) {
  console.log('[catalog-maturity] binding gaps:');
  for (const gap of report.bindingGaps) {
    console.log(`  - ${gap.paletteItemId}: bindingStatus=${gap.bindingStatus}`);
  }
}
