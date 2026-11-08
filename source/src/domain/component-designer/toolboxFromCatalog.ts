/**
 * Public Toolbox is derived from Base Components sections.
 * Identity only maps a section onto a droppable palette item — it is not a second catalog.
 */
import {
  getCatalogSection,
  listCatalogSectionGroups,
  listCatalogSectionMeta,
  type BaseComponentsSectionGroupId,
} from '../base-components/catalogAccess';
import {
  getCompileComponentId,
  getDesignerCatalogIdentity,
  isPublicToolboxIdentityKind,
  listPublicToolboxIdentityRows,
} from './designerCatalogIdentity';
import {
  applyCatalogIdentityToPalette,
  isPublicToolboxPaletteItem,
  resolvePublicToolboxLabel,
} from './publicToolboxPalette';
import type { DesignerPaletteItem } from './types';

export type CatalogToolboxGroupId = BaseComponentsSectionGroupId;

export type CatalogToolboxGroup = {
  category: CatalogToolboxGroupId;
  label: string;
  items: DesignerPaletteItem[];
};

const PUBLIC_ROWS_BY_SECTION = (() => {
  const map = new Map<string, string[]>();
  for (const row of listPublicToolboxIdentityRows()) {
    const ids = map.get(row.componentId) ?? [];
    ids.push(row.paletteItemId);
    map.set(row.componentId, ids);
  }
  return map;
})();

const NAV_INDEX_BY_SECTION = (() => {
  const map = new Map<string, number>();
  listCatalogSectionMeta().forEach((section, index) => {
    map.set(section.id, index);
  });
  return map;
})();

export const isPublicCatalogToolboxSection = (sectionId: string): boolean =>
  (PUBLIC_ROWS_BY_SECTION.get(sectionId)?.length ?? 0) > 0;

export const listPublicCatalogToolboxSections = () =>
  listCatalogSectionMeta().filter((section) => isPublicCatalogToolboxSection(section.id));

export const resolveCatalogToolboxGroup = (
  item: Pick<DesignerPaletteItem, 'id' | 'category'>,
): CatalogToolboxGroupId => {
  const componentId = getCompileComponentId(item.id)
    ?? getDesignerCatalogIdentity(item.id)?.componentId;
  const group = componentId ? getCatalogSection(componentId)?.group : undefined;
  if (group) {
    return group;
  }
  if (item.category === 'shell-chrome' || item.category === 'platform-slots') {
    return 'shell';
  }
  return 'data';
};

const compareCatalogToolboxItems = (
  left: DesignerPaletteItem,
  right: DesignerPaletteItem,
): number => {
  const leftSection = getCompileComponentId(left.id) ?? '';
  const rightSection = getCompileComponentId(right.id) ?? '';
  const leftRank = NAV_INDEX_BY_SECTION.get(leftSection) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = NAV_INDEX_BY_SECTION.get(rightSection) ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const leftIds = PUBLIC_ROWS_BY_SECTION.get(leftSection) ?? [];
  const rightIds = PUBLIC_ROWS_BY_SECTION.get(rightSection) ?? [];
  return leftIds.indexOf(left.id) - rightIds.indexOf(right.id);
};

/**
 * Public tray in Base Components nav order, labels from section titles.
 */
export const buildPublicToolboxFromCatalog = (
  palette: readonly DesignerPaletteItem[],
): DesignerPaletteItem[] => {
  const byId = new Map(
    applyCatalogIdentityToPalette(palette).map((item) => [item.id, item]),
  );
  const items: DesignerPaletteItem[] = [];
  for (const section of listPublicCatalogToolboxSections()) {
    for (const paletteItemId of PUBLIC_ROWS_BY_SECTION.get(section.id) ?? []) {
      const item = byId.get(paletteItemId);
      if (!item || !isPublicToolboxPaletteItem(item)) {
        continue;
      }
      const identity = getDesignerCatalogIdentity(item.id);
      if (!identity || !isPublicToolboxIdentityKind(identity.kind)) {
        continue;
      }
      items.push({
        ...item,
        label: resolvePublicToolboxLabel(item),
      });
    }
  }
  return items;
};

export const buildCatalogToolboxGroups = (
  items: readonly DesignerPaletteItem[],
): CatalogToolboxGroup[] => (
  listCatalogSectionGroups()
    .map((group) => ({
      category: group.id,
      label: group.label,
      items: items
        .filter((item) => resolveCatalogToolboxGroup(item) === group.id)
        .slice()
        .sort(compareCatalogToolboxItems),
    }))
    .filter((group) => group.items.length > 0)
);
