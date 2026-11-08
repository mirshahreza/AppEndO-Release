import { describe, expect, it } from 'vitest';
import { listCatalogComponentIds } from '../../../domain/base-components/catalogAccess';
import { getCompileComponentId } from '../../../domain/component-designer/designerCatalogIdentity';
import { DESIGNER_PALETTE } from '../../../domain/component-designer/catalog';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { BASE_COMPONENTS_SECTIONS } from '../baseComponentsSections';

const LEVEL_1_SECTIONS = [
  'user-card',
  'snippet',
  'hover-card',
  'context-menu',
  'command-palette',
  'sortable-list',
  'comparison-slider',
] as const;

const LEVEL_1_PALETTE = [
  ['user-card', 'heroui.user-card'],
  ['snippet', 'heroui.snippet'],
  ['hover-card', 'heroui.hover-card'],
  ['context-menu', 'heroui.context-menu'],
  ['command-palette', 'heroui.command-palette'],
  ['sortable-list', 'heroui.sortable-list'],
  ['comparison-slider', 'heroui.comparison-slider'],
] as const;

describe('p-104 level 1 catalog', () => {
  it('registers the seven composite sections with production options', () => {
    const sectionIds = new Set(BASE_COMPONENTS_SECTIONS.map((section) => section.id));
    const catalogIds = new Set(listCatalogComponentIds());
    for (const id of LEVEL_1_SECTIONS) {
      expect(sectionIds.has(id)).toBe(true);
      expect(catalogIds.has(id)).toBe(true);
      expect(getBaseComponentOptions(id).some((option) => (
        option.disposition === 'public-prop' || option.disposition === 'composition-prop'
      ))).toBe(true);
    }
  });

  it('wires Toolbox ids to the new sections', () => {
    for (const [componentId, paletteItemId] of LEVEL_1_PALETTE) {
      expect(getCompileComponentId(paletteItemId)).toBe(componentId);
      expect(DESIGNER_PALETTE.some((item) => item.id === paletteItemId && !item.legacy)).toBe(true);
    }
  });
});
