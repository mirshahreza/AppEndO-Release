import { describe, expect, it } from 'vitest';
import { listCatalogComponentIds } from '../../../domain/base-components/catalogAccess';
import { getCompileComponentId } from '../../../domain/component-designer/designerCatalogIdentity';
import { DESIGNER_PALETTE } from '../../../domain/component-designer/catalog';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { BASE_COMPONENTS_SECTIONS } from '../baseComponentsSections';

const LEVEL_3_SECTIONS = [
  'mermaid-diagram',
  'virtualized-list',
] as const;

const LEVEL_3_PALETTE = [
  ['mermaid-diagram', 'content.mermaid'],
  ['virtualized-list', 'content.virtualized-list'],
] as const;

describe('p-104 level 3 catalog', () => {
  it('registers mermaid and virtualized list with production options', () => {
    const sectionIds = new Set(BASE_COMPONENTS_SECTIONS.map((section) => section.id));
    const catalogIds = new Set(listCatalogComponentIds());
    for (const id of LEVEL_3_SECTIONS) {
      expect(sectionIds.has(id)).toBe(true);
      expect(catalogIds.has(id)).toBe(true);
      expect(getBaseComponentOptions(id).some((option) => (
        option.disposition === 'public-prop' || option.disposition === 'composition-prop'
      ))).toBe(true);
    }
  });

  it('wires Toolbox ids to the new sections', () => {
    for (const [componentId, paletteItemId] of LEVEL_3_PALETTE) {
      expect(getCompileComponentId(paletteItemId)).toBe(componentId);
      expect(DESIGNER_PALETTE.some((item) => item.id === paletteItemId && !item.legacy)).toBe(true);
    }
  });

  it('does not add a parallel Three section beside visual-engines', () => {
    const sectionIds = BASE_COMPONENTS_SECTIONS.map((section) => section.id);
    expect(sectionIds).toContain('visual-engines');
    expect(sectionIds.some((id) => id.includes('three') || id.includes('3d-scene'))).toBe(false);
  });
});
