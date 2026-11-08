import { describe, expect, it } from 'vitest';
import {
  BINDING_CAPABILITY_PARITY_STATUS,
  buildBindingCapabilityMatrix,
  getBindingCapabilityRow,
  resolveBindingCapabilityWarning,
  resolvePaletteBindingStatus,
  summarizeBindingCapabilityMatrix,
} from '../bindingCapabilityMatrix';
import { buildToolboxInventoryMatrix } from '../toolboxInventory';

describe('binding capability matrix (T1-19)', () => {
  it('covers every catalog palette item', () => {
    const matrix = buildBindingCapabilityMatrix();
    const inventory = buildToolboxInventoryMatrix();
    expect(matrix.length).toBe(inventory.length);
    expect(matrix.length).toBeGreaterThan(80);
  });

  it('reports no binding for html.image (representative static item)', () => {
    const row = getBindingCapabilityRow('html.image');
    expect(row).toBeDefined();
    expect(row?.supportedCapabilities).toEqual([]);
    expect(row?.bindingStatus).toBe('none');
    expect(row?.parityTested).toBe(false);
    expect(resolveBindingCapabilityWarning('html.image')).toBeNull();
  });

  it('reports parity-tested Chart binding for viz.chart-bar (representative complete item)', () => {
    const row = getBindingCapabilityRow('viz.chart-bar');
    expect(row).toBeDefined();
    expect(row?.supportedCapabilities).toContain('Chart');
    expect(row?.bindingStatus).toBe('parity-tested');
    expect(row?.parityTested).toBe(true);
    expect(row?.incompleteCapabilities).toEqual([]);
    expect(resolveBindingCapabilityWarning('viz.chart-bar')).toBeNull();
  });

  it('reports parity-tested EntityPicker binding for heroui.entity-picker (T1-23a fix)', () => {
    const row = getBindingCapabilityRow('heroui.entity-picker');
    expect(row).toBeDefined();
    expect(row?.supportedCapabilities).toEqual(['EntityPicker']);
    expect(row?.bindingStatus).toBe('parity-tested');
    expect(row?.parityTested).toBe(true);
    expect(row?.incompleteCapabilities).toEqual([]);
    expect(resolveBindingCapabilityWarning('heroui.entity-picker')).toBeNull();
  });

  it('aggregates worst capability status when an item has multiple bindings', () => {
    // PROD-6 (2026-07) fixed LOV end-to-end, so every real capability is now
    // 'parity-tested' and this branch has no live example in the catalog.
    // Force one capability back to 'partial' to keep the "worst status wins"
    // logic itself under regression coverage, independent of catalog state.
    const original = BINDING_CAPABILITY_PARITY_STATUS.LOV;
    (BINDING_CAPABILITY_PARITY_STATUS as Record<string, string>).LOV = 'partial';
    try {
      const status = resolvePaletteBindingStatus(['Region', 'LOV']);
      expect(status.bindingStatus).toBe('partial');
      expect(status.incompleteCapabilities).toEqual(['LOV']);
    } finally {
      (BINDING_CAPABILITY_PARITY_STATUS as Record<string, string>).LOV = original;
    }
  });

  it('reports parity-tested for Region+LOV now that LOV is fixed end-to-end (PROD-6)', () => {
    const status = resolvePaletteBindingStatus(['Region', 'LOV']);
    expect(status.bindingStatus).toBe('parity-tested');
    expect(status.incompleteCapabilities).toEqual([]);
  });

  it('merges bindingStatus into toolbox inventory rows', () => {
    const inventoryRow = buildToolboxInventoryMatrix().find(
      (row) => row.paletteItemId === 'heroui.entity-picker',
    );
    expect(inventoryRow?.bindingStatus).toBe('parity-tested');
    expect(inventoryRow?.supportedBindingCapabilities).toContain('EntityPicker');
    expect(inventoryRow?.bindingParityTested).toBe(true);
  });

  it('summarizes binding coverage counts', () => {
    const summary = summarizeBindingCapabilityMatrix();
    expect(summary.total).toBeGreaterThan(80);
    expect(summary.none).toBeGreaterThan(0);
    expect(summary.parityTested).toBeGreaterThan(0);
    expect(summary.broken).toBe(0);
    expect(summary.withBindingSupport).toBe(
      summary.parityTested + summary.partial + summary.broken,
    );
  });
});
