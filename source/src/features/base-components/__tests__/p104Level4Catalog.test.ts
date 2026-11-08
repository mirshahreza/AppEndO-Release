import { describe, expect, it } from 'vitest';
import { listCatalogComponentIds } from '../../../domain/base-components/catalogAccess';
import { getCompileComponentId } from '../../../domain/component-designer/designerCatalogIdentity';
import { DESIGNER_PALETTE } from '../../../domain/component-designer/catalog';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { BASE_COMPONENTS_SECTIONS } from '../baseComponentsSections';

const LEVEL_4_SECTIONS = [
  'signature-pad',
  'menubar',
  'code-scanner',
  'document-viewer',
] as const;

const LEVEL_4_PALETTE = [
  ['signature-pad', 'form.signature-pad'],
  ['menubar', 'content.menubar'],
  ['code-scanner', 'form.code-scanner'],
  ['document-viewer', 'content.document-viewer'],
] as const;

describe('p-104 level 4 catalog', () => {
  it('registers the four remaining sections with production options', () => {
    const sectionIds = new Set(BASE_COMPONENTS_SECTIONS.map((section) => section.id));
    const catalogIds = new Set(listCatalogComponentIds());
    for (const id of LEVEL_4_SECTIONS) {
      expect(sectionIds.has(id)).toBe(true);
      expect(catalogIds.has(id)).toBe(true);
      expect(getBaseComponentOptions(id).some((option) => (
        option.disposition === 'public-prop' || option.disposition === 'composition-prop'
      ))).toBe(true);
    }
  });

  it('wires Toolbox ids to the new sections', () => {
    for (const [componentId, paletteItemId] of LEVEL_4_PALETTE) {
      expect(getCompileComponentId(paletteItemId)).toBe(componentId);
      expect(DESIGNER_PALETTE.some((item) => item.id === paletteItemId && !item.legacy)).toBe(true);
    }
  });
});
