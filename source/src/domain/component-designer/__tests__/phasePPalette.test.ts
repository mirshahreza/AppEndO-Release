import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { UNIVERSAL_PALETTE_ITEM_IDS } from '../designerUniversalPalette';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';

const insertUniversalItem = (itemId: string) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });
  return state;
};

describe('Phase P universal palette (CD-P04–P37)', () => {
  it('registers all MVP universal palette ids in catalog', () => {
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('marketing.faq-accordion');
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('feedback.empty-state');
    expect(UNIVERSAL_PALETTE_ITEM_IDS.length).toBeGreaterThanOrEqual(22);
  });

  it.each(UNIVERSAL_PALETTE_ITEM_IDS)('generates valid TSX for %s', async (itemId) => {
    const state = insertUniversalItem(itemId);
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];
    const spec = resolveTsxComponentSpec(node);
    expect(spec.kind).toBe('library-custom');
    const mediaIds = new Set([
      'content.video-player',
      'content.audio-player',
      'content.qr-code',
      'content.barcode',
    ]);
    if (mediaIds.has(itemId)) {
      expect(spec.importFrom).toContain('DesignerRuntimeMedia');
    } else {
      expect(spec.importFrom).toContain('DesignerRuntimeUniversalWidgets');
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
    assertValidTsxSyntax(itemId, tsx);
  });

  it('generates FAQ accordion TSX with runtime component', () => {
    const state = insertUniversalItem('marketing.faq-accordion');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalFaqAccordion');
  });

  it('generates visibility container TSX with condition prop', () => {
    const state = insertUniversalItem('logic.visibility-container');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalVisibilityContainer');
    expect(tsx).toContain('visibleCondition');
  });
});
