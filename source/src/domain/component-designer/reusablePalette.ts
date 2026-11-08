import type { DesignerPaletteItem } from './types';

export const REUSABLE_PALETTE_ITEM_ID_PREFIX = 'reusable.component.';

export type ReusableComponentSummary = {
  id: string;
  name: string;
  folder?: string;
};

export const toReusablePaletteItemId = (componentId: string): string =>
  `${REUSABLE_PALETTE_ITEM_ID_PREFIX}${componentId}`;

export const isReusablePaletteItemId = (itemId: string): boolean =>
  itemId.startsWith(REUSABLE_PALETTE_ITEM_ID_PREFIX);

export const getComponentIdFromPaletteItemId = (itemId: string): string | null => {
  if (!isReusablePaletteItemId(itemId)) {
    return null;
  }

  const componentId = itemId.slice(REUSABLE_PALETTE_ITEM_ID_PREFIX.length).trim();
  return componentId.length > 0 ? componentId : null;
};

export const buildReusablePaletteItems = (entries: ReusableComponentSummary[]): DesignerPaletteItem[] => (
  entries.map((entry) => ({
    id: toReusablePaletteItemId(entry.id),
    label: entry.name,
    category: 'platform-workspace',
    icon: 'Component',
    defaultProps: {
      componentId: entry.id,
      label: entry.name,
      folder: entry.folder ?? 'general',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'reusable',
    sourceRef: entry.id,
    nodeType: 'reusable-slot',
  }))
);
