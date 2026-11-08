/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';

describe('DesignerRuntimeDropdown preview', () => {
  it('renders static dropdown option items in Visual Preview', () => {
    const initial = createInitialDesignerState();
    const withDropdown = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withDropdown.selectedNodeId!;
    const state = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha item' },
        { id: 'beta', textValue: 'Beta item' },
      ]),
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);

    expect(screen.getByRole('menuitem', { name: 'Alpha item' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Beta item' })).toBeTruthy();
  });

  it('applies tailwind width utilities on the dropdown shell', () => {
    const initial = createInitialDesignerState();
    const withDropdown = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withDropdown.selectedNodeId!;
    const state = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'w-full max-w-md',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const shell = container.querySelector('[data-designer-component="heroui.dropdown"]');
    expect(shell?.className).toContain('w-full');
    expect(shell?.className).toContain('max-w-md');
  });
});
