/**
 * Public Live Designer Toolbox = Base Components catalog (p-103).
 * Labels come from the lab section title. Designer-only names stay off the tray.
 */
import { getCatalogSectionLabel } from '../base-components/catalogAccess';
import {
  getDesignerCatalogIdentity,
  getPackageGate,
  isLegacyPaletteItemId,
  isPublicToolboxIdentityKind,
  isShellOnlyPaletteItemId,
  listPublicToolboxIdentityRows,
} from './designerCatalogIdentity';
import type { DesignerPaletteItem } from './types';

const PUBLIC_TOOL_COUNT_BY_COMPONENT_ID = (() => {
  const counts = new Map<string, number>();
  for (const row of listPublicToolboxIdentityRows()) {
    counts.set(row.componentId, (counts.get(row.componentId) ?? 0) + 1);
  }
  return counts;
})();

export const isPublicToolboxPaletteItemId = (paletteItemId: string): boolean => {
  if (isShellOnlyPaletteItemId(paletteItemId) || getPackageGate(paletteItemId)) {
    return false;
  }
  const identity = getDesignerCatalogIdentity(paletteItemId);
  return Boolean(identity && isPublicToolboxIdentityKind(identity.kind));
};

export const isPublicToolboxPaletteItem = (item: Pick<DesignerPaletteItem, 'id' | 'legacy'>): boolean =>
  !item.legacy && isPublicToolboxPaletteItemId(item.id);

export const resolvePublicToolboxLabel = (
  item: Pick<DesignerPaletteItem, 'id' | 'label'>,
): string => {
  const identity = getDesignerCatalogIdentity(item.id);
  if (!identity?.componentId) {
    return item.label;
  }
  const sectionLabel = getCatalogSectionLabel(identity.componentId);
  if (!sectionLabel) {
    return item.label;
  }
  const publicCount = PUBLIC_TOOL_COUNT_BY_COMPONENT_ID.get(identity.componentId) ?? 0;
  return publicCount === 1 ? sectionLabel : item.label;
};

export const applyCatalogIdentityToPalette = (
  items: readonly DesignerPaletteItem[],
): DesignerPaletteItem[] =>
  items.map((item) => {
    const legacy = item.legacy === true || isLegacyPaletteItemId(item.id);
    const label = resolvePublicToolboxLabel(item);
    if (legacy === item.legacy && label === item.label) {
      return item;
    }
    return { ...item, legacy, label };
  });

export const filterPublicToolboxPalette = (
  items: readonly DesignerPaletteItem[],
): DesignerPaletteItem[] => applyCatalogIdentityToPalette(items).filter(isPublicToolboxPaletteItem);
