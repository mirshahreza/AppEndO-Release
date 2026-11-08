import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';

describe('component designer phase 3 palette items', () => {
  it('generates UiAutocomplete TSX with items array (parity with Preview wrapper)', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.autocomplete',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    expect(resolveTsxComponentSpec(node).reactTag).toBe('UiAutocomplete');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('UiAutocomplete');
    expect(tsx).toContain("from '@/shared/ui/HeroFieldControls'");
    expect(tsx).toMatch(/items=\{\[/);
    expect(tsx).not.toContain('Autocomplete.Trigger');
  });

  it('generates iframe and file-upload HTML TSX', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.iframe',
      parentId: state.document.rootNodeId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.file-upload',
      parentId: state.document.rootNodeId,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<iframe');
    expect(tsx).toContain('allowFullScreen');
    // Phase 45: file-upload export now renders the shared, enriched DesignerRuntimeFileUpload
    // component (which itself contains the real <input type="file">) instead of inlining raw
    // <label>/<input> JSX per export.
    expect(tsx).toContain('<DesignerRuntimeFileUpload');
  });

  it('inserts layout dock pane as a left rail on the page, not a top strip', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.dock-pane',
      parentId: state.document.rootNodeId,
    });
    const hostId = state.document.nodes[state.document.rootNodeId].children[0];
    const host = state.document.nodes[hostId];
    expect(host.props._designerPaletteItemId).toBe('layout.flex-row');
    expect(host.props._designerDockHost).toBe(true);
    expect(String(host.props.className)).toContain('flex-row');
    expect(String(host.props.className)).toContain('h-full');

    const paneId = host.children[0];
    const pane = state.document.nodes[paneId];
    expect(pane.props._designerPaletteItemId).toBe('layout.dock-pane');
    expect(pane.props.dock).toBe('left');
    expect(String(pane.props.className)).toContain('bg-default-50');
    expect(String(pane.props.className)).not.toContain('min-h-[240px]');

    const contentId = host.children[1];
    const content = state.document.nodes[contentId];
    expect(content.props._designerPaletteItemId).toBe('layout.flex-column');
    expect(String(content.props.className)).toContain('flex-1');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('UiDockPane');
    expect(tsx).toContain('dock="left"');
  });

  it('moves existing page children beside a dropped dock pane', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.heading',
      parentId: state.document.rootNodeId,
    });
    const headingId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.dock-pane',
      parentId: state.document.rootNodeId,
    });
    const host = state.document.nodes[state.document.nodes[state.document.rootNodeId].children[0]!];
    const content = state.document.nodes[host.children[1]!];
    expect(content.children).toEqual([headingId]);
    expect(state.document.nodes[headingId].parentId).toBe(content.id);
  });

  it('inserts dock pane directly into an existing flex row', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: state.document.rootNodeId,
    });
    const rowId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.dock-pane',
      parentId: rowId,
    });
    const paneId = state.document.nodes[rowId].children[0]!;
    expect(state.document.nodes[paneId].props._designerPaletteItemId).toBe('layout.dock-pane');
    expect(state.document.nodes[state.document.rootNodeId].children).toEqual([rowId]);
  });

  it('reorders the auto host when dock changes to right or top', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.dock-pane',
      parentId: state.document.rootNodeId,
    });
    const hostId = state.document.nodes[state.document.rootNodeId].children[0]!;
    const paneId = state.document.nodes[hostId].children[0]!;
    const contentId = state.document.nodes[hostId].children[1]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paneId,
      key: 'dock',
      value: 'right',
    });
    expect(state.document.nodes[paneId].props.dock).toBe('right');
    expect(state.document.nodes[hostId].children).toEqual([contentId, paneId]);
    expect(String(state.document.nodes[hostId].props.className)).toContain('flex-row');

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paneId,
      key: 'dock',
      value: 'top',
    });
    expect(state.document.nodes[hostId].props._designerPaletteItemId).toBe('layout.flex-column');
    expect(String(state.document.nodes[hostId].props.className)).toContain('flex-col');
    expect(state.document.nodes[hostId].children).toEqual([paneId, contentId]);
  });
});
