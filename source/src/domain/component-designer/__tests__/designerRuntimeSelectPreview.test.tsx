/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';

describe('DesignerRuntimeSelect preview', () => {
  it('shows select options inline when the trigger is clicked', () => {
    const initial = createInitialDesignerState();
    const withSelect = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withSelect.selectedNodeId!;
    const state = designerReducer(withSelect, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha item' },
        { id: 'beta', textValue: 'Beta item' },
      ]),
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);

    fireEvent.click(screen.getByRole('button', { name: /Select…/ }));

    expect(screen.getByRole('option', { name: 'Alpha item' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Beta item' })).toBeTruthy();
  });

  it('uses the current document language when a language default map is configured', () => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = 'fa-IR';

    const initial = createInitialDesignerState();
    const withSelect = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withSelect.selectedNodeId!;
    let state = designerReducer(withSelect, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'language-en', textValue: 'English' },
        { id: 'language-fa', textValue: 'Persian' },
      ]),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'selectedKeyByLanguage',
      value: JSON.stringify({ en: 'language-en', fa: 'language-fa' }),
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);

    const triggers = screen.getAllByRole('button', { name: /Select…/ });
    const triggerText = triggers[triggers.length - 1]?.textContent;
    document.documentElement.lang = previousLanguage;
    expect(triggerText).toContain('Persian');
  });
});
