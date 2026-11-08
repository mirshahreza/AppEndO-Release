import { describe, expect, it } from 'vitest';
import { CultureProvider, useCulture } from '../../../core/culture/CultureContext';
import { generateDesignerTsx } from '../codegen';
import {
  formatPreviewCultureScalar,
  inferGridColumnPreviewKind,
  resolvePreviewBoundFieldKind,
} from '../previewCultureFormatting';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  resolveTranslatableTextPreview,
  TEXT_CONTENT_MODE_TRANSLATION,
  TRANSLATION_KEY_PROP,
} from '../translatableTextContent';

describe('previewCultureFormatting', () => {
  it('formats numbers and dates per locale and calendar', () => {
    expect(
      formatPreviewCultureScalar(1234567, { locale: 'en-US', calendar: 'gregorian' }, 'number'),
    ).toBe('1,234,567');
    expect(
      formatPreviewCultureScalar('2026-06-15T14:30:00.000Z', { locale: 'en-US', calendar: 'jalali' }, 'date'),
    ).toBe('1405-03-25');
    expect(inferGridColumnPreviewKind('2026-06-15T14:30:00.000Z')).toBe('date');
    expect(inferGridColumnPreviewKind(42)).toBe('number');
  });

  it('resolves bound field kinds from palette item ids', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.date-picker',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    expect(resolvePreviewBoundFieldKind(state.document.nodes[nodeId])).toBe('date');

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.number-input',
      parentId: state.document.rootNodeId,
    });
    const numberNodeId = state.document.nodes[state.document.rootNodeId].children[1] as string;
    expect(resolvePreviewBoundFieldKind(state.document.nodes[numberNodeId])).toBe('number');
  });

  it('Preview and Export share CultureContext and translation key resolution (T1-10 Culture parity)', () => {
    // Same module Export imports (`@/core/culture/CultureContext`) and Preview wraps.
    expect(typeof CultureProvider).toBe('function');
    expect(typeof useCulture).toBe('function');

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
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

    const node = state.document.nodes[nodeId]!;
    const translate = (key: string) => (key === 'nav.dashboard' ? 'Dashboard' : key);

    // Preview path (DesignerDocumentPreview → culture.t via CultureContext).
    expect(resolveTranslatableTextPreview(node, translate, 'Fallback')).toBe('Dashboard');

    // Export path — same CultureContext hook + same culture.t(key) call site.
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain("import { useCulture } from '@/core/culture/CultureContext';");
    expect(tsx).toContain('const culture = useCulture();');
    expect(tsx).toContain('culture.t("nav.dashboard")');

    // CultureContext locale/calendar fields drive Preview formatting (Export runtime uses the same provider).
    expect(
      formatPreviewCultureScalar(1234567, { locale: 'en-US', calendar: 'gregorian' }, 'number'),
    ).toBe('1,234,567');
    expect(
      formatPreviewCultureScalar('2026-06-15T14:30:00.000Z', { locale: 'fa-IR', calendar: 'jalali' }, 'date'),
    ).toBe('1405-03-25');
  });
});
