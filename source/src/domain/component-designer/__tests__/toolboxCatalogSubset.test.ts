import { describe, expect, it } from 'vitest';
import {
  getCatalogSection,
  getCatalogSectionLabel,
  listCatalogComponentIds,
  listCatalogSectionGroups,
  listCatalogSectionMeta,
} from '../../base-components/catalogAccess';
import { DESIGNER_PALETTE } from '../catalog';
import {
  DESIGNER_CATALOG_IDENTITY,
  getCompileComponentId,
  getDesignerCatalogIdentity,
  identityRowsRequiringSection,
  isLegacyPaletteItemId,
  isParkedPaletteItemId,
  isPublicToolboxIdentityKind,
  isShellOnlyPaletteItemId,
  listPublicToolboxIdentityRows,
} from '../designerCatalogIdentity';
import { filterPublicToolboxPalette, resolvePublicToolboxLabel } from '../publicToolboxPalette';
import {
  buildCatalogToolboxGroups,
  buildPublicToolboxFromCatalog,
  listPublicCatalogToolboxSections,
} from '../toolboxFromCatalog';

describe('Toolbox ⊆ Base Components catalog', () => {
  it('every public Toolbox id has an identity row', () => {
    const publicIds = DESIGNER_PALETTE
      .filter((item) => !item.legacy && !isShellOnlyPaletteItemId(item.id))
      .map((item) => item.id);
    const missing = publicIds.filter((id) => !getDesignerCatalogIdentity(id));
    expect(missing).toEqual([]);
  });

  it('every compile / add-to-toolbox identity row has a Base Components section', () => {
    const sectionIds = new Set(listCatalogComponentIds());
    const missing = identityRowsRequiringSection().filter((row) => !sectionIds.has(row.componentId));
    expect(missing).toEqual([]);
  });

  it('legacy merge losers stay resolvable and hidden from new drops', () => {
    const losers = DESIGNER_CATALOG_IDENTITY.filter((row) => row.kind === 'legacy');
    expect(losers.length).toBeGreaterThan(0);
    for (const row of losers) {
      expect(isLegacyPaletteItemId(row.paletteItemId)).toBe(true);
      expect(DESIGNER_PALETTE.some((item) => item.id === row.paletteItemId && item.legacy === true)).toBe(true);
    }
  });

  it('the public Toolbox tray is only catalog-backed compile / add-to-toolbox items', () => {
    const publicItems = filterPublicToolboxPalette(DESIGNER_PALETTE);
    const publicIds = new Set(publicItems.map((item) => item.id));
    const expectedIds = new Set(listPublicToolboxIdentityRows().map((row) => row.paletteItemId));

    expect([...publicIds].sort()).toEqual([...expectedIds].sort());
    expect(publicItems.some((item) => item.legacy)).toBe(false);
    expect(publicItems.some((item) => isParkedPaletteItemId(item.id))).toBe(false);
    expect(publicItems.some((item) => isShellOnlyPaletteItemId(item.id))).toBe(false);
    for (const item of publicItems) {
      const identity = getDesignerCatalogIdentity(item.id);
      expect(identity).toBeDefined();
      expect(isPublicToolboxIdentityKind(identity!.kind)).toBe(true);
    }
  });

  it('reads Toolbox labels from Base Components section titles', () => {
    const grid = DESIGNER_PALETTE.find((item) => item.id === 'heroui.app-table-grid');
    expect(grid?.label).toBe('Grid');
    expect(getCatalogSectionLabel('grid')).toBe('Grid');
    expect(resolvePublicToolboxLabel({ id: 'heroui.app-table-grid', label: 'App Table Grid' })).toBe('Grid');

    const publicItems = filterPublicToolboxPalette(DESIGNER_PALETTE);
    expect(publicItems.find((item) => item.id === 'heroui.app-table-grid')?.label).toBe('Grid');
    expect(publicItems.some((item) => item.label === 'App Table Grid')).toBe(false);

    const publicCountBySection = new Map<string, number>();
    for (const row of listPublicToolboxIdentityRows()) {
      publicCountBySection.set(row.componentId, (publicCountBySection.get(row.componentId) ?? 0) + 1);
    }
    for (const item of publicItems) {
      const identity = getDesignerCatalogIdentity(item.id)!;
      if ((publicCountBySection.get(identity.componentId) ?? 0) === 1) {
        expect(item.label).toBe(getCatalogSectionLabel(identity.componentId));
      }
    }
  });

  it('derives Toolbox groups, membership, and order from Base Components nav', () => {
    const tray = buildPublicToolboxFromCatalog(DESIGNER_PALETTE);
    const grouped = buildCatalogToolboxGroups(tray);
    const publicSections = listPublicCatalogToolboxSections();
    const catalogGroups = listCatalogSectionGroups();

    expect(grouped.map((group) => group.category)).toEqual(
      catalogGroups
        .map((group) => group.id)
        .filter((id) => publicSections.some((section) => section.group === id)),
    );
    expect(grouped.map((group) => group.label)).toEqual(
      grouped.map((group) => catalogGroups.find((entry) => entry.id === group.category)?.label),
    );

    const traySectionIds = [...new Set(tray.map((item) => getCompileComponentId(item.id)))];
    expect(traySectionIds).toEqual(publicSections.map((section) => section.id));

    for (const group of grouped) {
      const expectedOrder = publicSections
        .filter((section) => section.group === group.category)
        .map((section) => section.id);
      const actualOrder = [...new Set(group.items.map((item) => getCompileComponentId(item.id)))];
      expect(actualOrder).toEqual(expectedOrder);
    }
  });

  it('keeps identity toolboxGroup aligned with the catalog section group', () => {
    for (const row of listPublicToolboxIdentityRows()) {
      expect(getCatalogSection(row.componentId)?.group).toBe(row.toolboxGroup);
    }
    expect(listCatalogSectionMeta().length).toBeGreaterThan(listPublicCatalogToolboxSections().length);
  });
});
