import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertPhasePInventoryCoverage,
  buildCatalogMaturityReport,
  buildToolboxInventoryMatrix,
  collectBindingCapabilityGaps,
  collectToolboxMaturityGaps,
  PRESET_WIDGET_PARITY_CHECKLIST,
  summarizeToolboxInventory,
} from '../toolboxInventory';
import { UNIVERSAL_PALETTE_ITEM_IDS } from '../designerUniversalPalette';
import { PHASE_P_WAVE2_RENDERED_IDS } from '../runtimeShared';

const reportDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../docs/refactor-spec');
const reportPath = path.join(reportDir, 'catalog-maturity-report.json');

describe('toolbox inventory matrix (CD-P01 / T1-7)', () => {
  it('builds have/partial/missing rows for every catalog id', () => {
    const rows = buildToolboxInventoryMatrix();
    expect(rows.length).toBeGreaterThan(80);
    const summary = summarizeToolboxInventory(rows);
    expect(summary.total).toBe(rows.length);
    expect(summary.have).toBeGreaterThan(60);
    expect(rows.every((row) => typeof row.eventComplete === 'boolean')).toBe(true);
    expect(rows.every((row) => typeof row.bindingStatus === 'string')).toBe(true);
    expect(rows.every((row) => Array.isArray(row.supportedBindingCapabilities))).toBe(true);
  });

  it('treats structural primitives, date-picker, and repeater as runtime-covered', () => {
    const byId = new Map(buildToolboxInventoryMatrix().map((row) => [row.paletteItemId, row]));
    for (const id of [
      'html.container',
      'layout.flex-row',
      'tailwind.card',
      'heroui.date-picker',
      'logic.repeater',
    ]) {
      expect(byId.get(id)?.runtime, id).toBe(true);
    }
  });

  it('writes catalog-maturity-report.json and lists remaining maturity gaps', () => {
    const report = buildCatalogMaturityReport();
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    expect(fs.existsSync(reportPath)).toBe(true);
    expect(report.summary.total).toBe(report.rows.length);
    expect(Array.isArray(report.remainingGaps)).toBe(true);
    expect(Array.isArray(report.bindingGaps)).toBe(true);
    expect(collectToolboxMaturityGaps(report.rows)).toEqual(report.remainingGaps);
    expect(collectBindingCapabilityGaps(report.rows)).toEqual(report.bindingGaps);
    expect(report.summary.binding).toBeDefined();
    expect(report.summary.binding.broken).toBe(0);
  });

  /**
   * Cluster G close-out (2026-07): the last 20 flagged items are now resolved —
   * assertPhasePInventoryCoverage is a hard green CI gate. Kept as an explicit empty
   * list (rather than deleting the check) so any future regression is caught immediately
   * instead of silently reappearing as a "gap that was always there."
   *
   * The 19 `inspector:false` html.* / layout.* / tailwind.* items were detector false
   * negatives: `hasInspectorFields` (toolboxInventory.ts) only recognized membership in
   * the dedicated field-map dictionaries, but every one of them already had a real,
   * working Inspector surface via the generic Tailwind className system
   * (`resolveTailwindInspectorFields` falls back to the full TAILWIND_INSPECTOR_FIELDS
   * list when an item has no dedicated subset) — confirmed via real DOM tests in Cluster A
   * (html.article, html.container, html.figure, html.form, html.heading, html.link,
   * html.list-item, html.section, html.table-wrap, html.text, layout.stack-compact,
   * layout.stack-relaxed) and Cluster D (tailwind.alert, tailwind.card,
   * tailwind.card-glass, tailwind.hero, tailwind.image-overlay, tailwind.pricing,
   * tailwind.stat-block). The detector now also checks `resolveTailwindInspectorFields`.
   *
   * heroui.tags-input was a genuine gap, now fixed: codegen (tsxParityPalette.ts
   * renderTagsInputParityJsx) previously rendered static read-only chips with no
   * add/remove interaction at all. codegen.ts's hookDefinitionLines/preamble mechanism
   * now also emits a per-node useState<string[]> (+ draft input + add/remove callbacks)
   * for every heroui.tags-input node in the document
   * (`renderTagsInputStatePreambleLines`), and the exported JSX wires a real
   * `<input type="text">` + remove buttons to it — matching the preview UX. See
   * src/domain/component-designer/__tests__/tagsInputInteraction.test.tsx and
   * docs/refactor-spec/CLAUDE-FULL-AUDIT-LOG-cluster-G-close-remaining-badges.md.
   */
  const T1_7_REMAINING_GAP_IDS: readonly string[] = [];

  it('locks remaining maturity gaps pending human STATIC/fix decisions (T1-7)', () => {
    const gapIds = collectToolboxMaturityGaps().map((gap) => gap.paletteItemId).sort();
    expect(gapIds).toEqual([...T1_7_REMAINING_GAP_IDS].sort());
  });

  it('wires assertPhasePInventoryCoverage as full-catalog CI gate', () => {
    const gaps = collectToolboxMaturityGaps();
    if (gaps.length === 0) {
      expect(() => assertPhasePInventoryCoverage()).not.toThrow();
      return;
    }
    expect(() => assertPhasePInventoryCoverage()).toThrow(/Toolbox inventory failed/);
  });

  it('maps at least 20 layout presets to palette widgets (CD-P35)', () => {
    expect(PRESET_WIDGET_PARITY_CHECKLIST.length).toBeGreaterThanOrEqual(20);
  });

  it('tracks wave-2 HeroUI parity ids', () => {
    for (const id of PHASE_P_WAVE2_RENDERED_IDS) {
      expect(PHASE_P_WAVE2_RENDERED_IDS.has(id)).toBe(true);
    }
  });

  it('registers universal MVP widget ids', () => {
    expect(UNIVERSAL_PALETTE_ITEM_IDS.length).toBeGreaterThanOrEqual(22);
  });
});
