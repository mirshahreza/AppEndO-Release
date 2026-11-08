import { describe, expect, it } from 'vitest';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import {
  buildSlotPaletteItems,
  getSlotIdFromPaletteItemId,
  isSlotPaletteItemId,
  toSlotPaletteItemId,
} from '../slotPalette';

describe('slotPalette', () => {
  it('builds palette items from catalog entries', () => {
    const items = buildSlotPaletteItems(CORE_SLOT_CATALOG);

    expect(items).toHaveLength(CORE_SLOT_CATALOG.length);
    expect(items[0]).toMatchObject({
      id: toSlotPaletteItemId(CORE_SLOT_CATALOG[0].id),
      category: 'platform-workspace',
      nodeType: 'system-slot',
      sourceType: 'system',
      sourceRef: CORE_SLOT_CATALOG[0].id,
      defaultProps: {
        slotId: CORE_SLOT_CATALOG[0].id,
        label: CORE_SLOT_CATALOG[0].label,
        surface: CORE_SLOT_CATALOG[0].surface,
      },
    });
  });

  it('resolves slot palette item ids', () => {
    const slotId = 'core.dashboard.widgets';
    const paletteItemId = toSlotPaletteItemId(slotId);

    expect(isSlotPaletteItemId(paletteItemId)).toBe(true);
    expect(getSlotIdFromPaletteItemId(paletteItemId)).toBe(slotId);
    expect(isSlotPaletteItemId('html.text')).toBe(false);
  });
});
