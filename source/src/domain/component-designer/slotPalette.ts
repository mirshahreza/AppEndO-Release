import type { SlotCatalogEntry } from '../../shared/api/contracts/slots/catalog';
import type { DesignerPaletteItem } from './types';

export const SLOT_PALETTE_ITEM_ID_PREFIX = 'platform.slot.';

export const toSlotPaletteItemId = (slotId: string): string => `${SLOT_PALETTE_ITEM_ID_PREFIX}${slotId}`;

export const isSlotPaletteItemId = (itemId: string): boolean => itemId.startsWith(SLOT_PALETTE_ITEM_ID_PREFIX);

export const getSlotIdFromPaletteItemId = (itemId: string): string | null => {
  if (!isSlotPaletteItemId(itemId)) {
    return null;
  }
  const slotId = itemId.slice(SLOT_PALETTE_ITEM_ID_PREFIX.length).trim();
  return slotId.length > 0 ? slotId : null;
};

export const buildSlotPaletteItems = (entries: SlotCatalogEntry[]): DesignerPaletteItem[] => (
  entries.map((entry) => ({
    id: toSlotPaletteItemId(entry.id),
    label: entry.label,
    category: 'platform-workspace',
    icon: 'Puzzle',
    defaultProps: {
      slotId: entry.id,
      label: entry.label,
      surface: entry.surface,
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'system',
    sourceRef: entry.id,
    nodeType: 'system-slot',
  }))
);
