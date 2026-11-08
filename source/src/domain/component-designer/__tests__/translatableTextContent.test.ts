import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  documentUsesTranslationKeys,
  isTranslationTextContentMode,
  resolveTranslatableTextPreview,
  TEXT_CONTENT_MODE_TRANSLATION,
  TRANSLATION_KEY_PROP,
} from '../translatableTextContent';

describe('translatableTextContent', () => {
  it('resolves translation preview via culture.t', () => {
    const state = createInitialDesignerState();
    const withText = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.heading',
      parentId: state.document.rootNodeId,
    });
    const root = withText.document.nodes[withText.document.rootNodeId];
    const nodeId = root.children[0] as string;
    const withTranslation = designerReducer(withText, {
      type: 'set-node-prop',
      nodeId,
      key: 'textContentMode',
      value: TEXT_CONTENT_MODE_TRANSLATION,
    });
    const translated = designerReducer(withTranslation, {
      type: 'set-node-prop',
      nodeId,
      key: TRANSLATION_KEY_PROP,
      value: 'nav.dashboard',
    });
    const node = translated.document.nodes[nodeId];

    expect(isTranslationTextContentMode(node)).toBe(true);
    expect(documentUsesTranslationKeys(translated.document)).toBe(true);
    expect(resolveTranslatableTextPreview(node, (key) => (key === 'nav.dashboard' ? 'Dashboard' : key), 'Fallback'))
      .toBe('Dashboard');
  });

  it('emits culture.t in generated TSX for translation mode', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
    });
    const root = state.document.nodes[state.document.rootNodeId];
    const nodeId = root.children[0] as string;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'textContentMode',
      value: TEXT_CONTENT_MODE_TRANSLATION,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: TRANSLATION_KEY_PROP,
      value: 'nav.dashboard',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('culture.t("nav.dashboard")');
    expect(tsx).toContain("import { useCulture } from '@/core/culture/CultureContext';");
  });
});
