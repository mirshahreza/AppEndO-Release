import { describe, expect, it } from 'vitest';
import { listCatalogComponentIds } from '../../../domain/base-components/catalogAccess';
import { getCompileComponentId } from '../../../domain/component-designer/designerCatalogIdentity';
import { DESIGNER_PALETTE } from '../../../domain/component-designer/catalog';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { BASE_COMPONENTS_SECTIONS } from '../baseComponentsSections';

const LEVEL_0_SECTIONS = [
  'notification-badge',
  'calendar-grid',
  'range-calendar-grid',
  'kbd',
] as const;

const LEVEL_0_PALETTE = [
  ['notification-badge', 'heroui.badge'],
  ['calendar-grid', 'heroui.calendar'],
  ['range-calendar-grid', 'heroui.range-calendar'],
  ['kbd', 'heroui.kbd'],
] as const;

describe('p-104 level 0 catalog', () => {
  it('registers the four new sections with production options', () => {
    const sectionIds = new Set(BASE_COMPONENTS_SECTIONS.map((section) => section.id));
    const catalogIds = new Set(listCatalogComponentIds());
    for (const id of LEVEL_0_SECTIONS) {
      expect(sectionIds.has(id)).toBe(true);
      expect(catalogIds.has(id)).toBe(true);
      expect(getBaseComponentOptions(id).some((option) => (
        option.disposition === 'public-prop' || option.disposition === 'composition-prop'
      ))).toBe(true);
    }
  });

  it('exposes prefix and suffix on text-fields', () => {
    const ids = getBaseComponentOptions('text-fields').map((option) => option.id);
    expect(ids).toEqual(expect.arrayContaining(['textFields.prefix', 'textFields.suffix']));
  });

  it('wires Toolbox ids to the new sections', () => {
    for (const [componentId, paletteItemId] of LEVEL_0_PALETTE) {
      expect(getCompileComponentId(paletteItemId)).toBe(componentId);
      expect(DESIGNER_PALETTE.some((item) => item.id === paletteItemId && !item.legacy)).toBe(true);
    }
  });
});
