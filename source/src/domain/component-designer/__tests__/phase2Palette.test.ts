import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { collectEntityPickerConfigs } from '../bindingEntityPickerCodegen';
import { generateDesignerTsx, generateDesignerTsxMeta, parseDesignerJson, parseDesignerTsxPair, syncCodeToCanvas } from '../codegen';
import { DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON, parseDesignerDataGridColumns } from '../designerDataGridColumns';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';
import { resolveNodeEventBindingTargets } from '../bindingEngine';

describe('component designer phase 2 palette items', () => {
  it('generates data grid TSX with table columns and pagination summary', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    expect(parseDesignerDataGridColumns(node.props.columns).length).toBeGreaterThan(0);
    expect(resolveTsxComponentSpec(node).importSymbols).toContain('Pagination');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Table.Column');
    expect(tsx).toContain('Pagination.Summary');
    expect(tsx).toContain('gridQueryMode');
  });

  it('generates entity picker TSX with async search hook helpers', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.entity-picker',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];

    const configs = collectEntityPickerConfigs(state.document);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entityRef).toBe('/api/entities');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('useEntityPickerOptions');
    // The real search endpoint/param reach the generated hook call args, just not as literal
    // `entityRef=`/`searchParam=` JSX attributes (parity audit item 27 — neither is a real prop
    // on the real Autocomplete component).
    expect(tsx).toContain('useEntityPickerOptions("/api/entities", "search"');
    expect(tsx).toContain('onInputChange');
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sentityRef=/);
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\ssearchParam=/);
  });

  it('generates date range picker TSX and resolves reverse-parse tag mapping', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'form.date-range',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    expect(resolveTsxComponentSpec(node).reactTag).toBe('DesignerDateRangeField');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerDateRangeField');

    const meta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
    const parsed = parseDesignerTsxPair(tsx, meta);
    expect(parsed.document.nodes[nodeId]?.props._designerPaletteItemId).toBe('form.date-range');
  });

  it('inserts split pane with two pane slots and layout defaults', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.split-pane',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    expect(node.children).toHaveLength(2);
    expect(node.props.direction).toBe('horizontal');
    expect(node.props.defaultSplit).toBe(50);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('data-split-direction="horizontal"');
    expect(tsx).toContain('data-split-pane-count="2"');
    expect(tsx).not.toContain('Master pane');
    expect(tsx).not.toContain('Detail pane');
  });

  // Bug found: split-pane codegen used to join every child's rendered JSX into one string and
  // split it back apart by '\n' to recover "pane 1" / "pane 2" — any child whose own JSX spanned
  // multiple lines (i.e. any non-trivial container) got shredded line-by-line, corrupting the
  // exported markup (an unclosed opening tag as pane 1, an inner grandchild's line as pane 2,
  // and the real second child + closing tag silently dropped). Split Pane must now keep each
  // child's full, multi-line JSX intact as a single array entry.
  it('keeps each pane fully intact in export when a pane contains a multi-line nested container', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.split-pane',
      parentId: state.document.rootNodeId,
    });
    const splitPaneId = state.document.nodes[state.document.rootNodeId].children[0];
    const paneIds = state.document.nodes[splitPaneId].children;
    expect(paneIds).toHaveLength(2);

    // Primary pane: a Container wrapping a Text grandchild — this is what used to get shredded.
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: paneIds[0],
    });
    const primaryContainerId = state.document.nodes[paneIds[0]].children[0];
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: primaryContainerId,
    });
    const primaryTextId = state.document.nodes[primaryContainerId].children[0];
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: primaryTextId,
      key: 'text',
      value: 'PRIMARY_PANE_MARKER_TEXT',
    });

    // Secondary pane: a plain Text node with its own distinct marker.
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: paneIds[1],
    });
    const secondaryTextId = state.document.nodes[paneIds[1]].children[0];
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: secondaryTextId,
      key: 'text',
      value: 'SECONDARY_PANE_MARKER_TEXT',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('split pane with multi-line primary pane', tsx);

    expect(tsx).toContain('PRIMARY_PANE_MARKER_TEXT');
    expect(tsx).toContain('SECONDARY_PANE_MARKER_TEXT');
    expect(tsx).not.toContain('Master pane');
    expect(tsx).not.toContain('Detail pane');
    // The default fallback panes must not leak in alongside the real content either.
  });

  it('exposes data grid sort and page events in the binding target registry', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    expect(resolveNodeEventBindingTargets(node)).toEqual(
      expect.arrayContaining(['onSortChange', 'onPageChange', 'onSelectionChange', 'onCellChange']),
    );
  });

  it('round-trips data grid columns and autocomplete items via meta sidecar context', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const customColumns = '[{"key":"sku","label":"SKU","sort":true}]';
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: customColumns,
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.autocomplete',
      parentId: state.document.rootNodeId,
    });
    const autocompleteNodeId = state.document.nodes[state.document.rootNodeId].children[1];
    const customItems = '[{"id":"a1","textValue":"Alpha"}]';
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: autocompleteNodeId,
      key: 'items',
      value: customItems,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toContain('data-designer-columns=');
    expect(tsx).toMatch(/<UiAutocomplete[^>]*\sitems=\{/);

    const synced = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(synced.ok, synced.ok === false ? synced.diagnostics.map((item) => item.message).join(' | ') : undefined).toBe(true);
    if (synced.ok) {
      expect(synced.document.nodes[gridNodeId]?.props.columns).toBe(customColumns);
      const autocompleteNode = Object.values(synced.document.nodes).find(
        (entry) => entry.props._designerPaletteItemId === 'heroui.autocomplete',
      );
      expect(autocompleteNode?.id).toBe(autocompleteNodeId);
      expect(autocompleteNode?.props.items).toBe(customItems);
    }
  });

  it('generates advanced form field TSX for code/html/mask/color/calculator controls', () => {
    const itemIds = ['form.code-editor', 'form.html-editor', 'form.markdown-editor', 'form.mask-input', 'form.calculator', 'heroui.color-control', 'heroui.date-picker'] as const;

    for (const itemId of itemIds) {
      let state = createInitialDesignerState();
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId,
        parentId: state.document.rootNodeId,
      });
      const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
      const node = state.document.nodes[nodeId];
      const expectedImportFrom = itemId === 'form.mask-input'
        ? '@/shared/ui/DesignerMaskInputField'
        : '@/shared/ui/DesignerFormFields';

      expect(resolveTsxComponentSpec(node).importFrom).toBe(expectedImportFrom);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain(resolveTsxComponentSpec(node).reactTag);

      const meta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
      const parsed = parseDesignerTsxPair(tsx, meta);
      expect(parsed.document.nodes[nodeId]?.props._designerPaletteItemId).toBe(itemId);
    }
  });

  it('round-trips phase 2 palette nodes through meta sidecar without losing palette ids', () => {
    let state = createInitialDesignerState();
    for (const itemId of ['heroui.data-grid', 'heroui.entity-picker', 'form.date-range', 'layout.split-pane'] as const) {
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId,
        parentId: state.document.rootNodeId,
      });
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const meta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
    const parsedFromMeta = parseDesignerJson(meta);
    const parsedFromPair = parseDesignerTsxPair(tsx, meta);

    for (const itemId of ['heroui.data-grid', 'heroui.entity-picker', 'form.date-range', 'layout.split-pane'] as const) {
      const metaNode = Object.values(parsedFromMeta.document.nodes).find(
        (entry) => entry.props._designerPaletteItemId === itemId,
      );
      expect(metaNode, itemId).toBeDefined();
    }

    expect(Object.keys(parsedFromPair.document.nodes).length).toBeGreaterThanOrEqual(
      Object.keys(parsedFromMeta.document.nodes).length,
    );
  });
});
