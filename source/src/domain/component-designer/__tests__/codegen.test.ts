import { describe, expect, it } from 'vitest';
import {
  generateDesignerJsonString,
  generateDesignerTsx,
  generateDesignerTsxDisplay,
  generateDesignerTsxMeta,
  parseDesignerJson,
  parseDesignerTsxPair,
  syncCodeToCanvas,
} from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';

describe('component designer phase D codegen/parser/sync', () => {
  const createPopulatedState = () => {
    const initial = createInitialDesignerState();
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const sectionId = withSection.document.nodes[withSection.document.rootNodeId].children[0];

    return designerReducer(withSection, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: sectionId,
    });
  };

  it('generates JSON payload from current document', () => {
    const state = createPopulatedState();
    const json = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = JSON.parse(json);

    expect(parsed.schema).toBe('component-designer-export');
    expect(parsed.document.rootNodeId).toBe('root');
    expect(Object.keys(parsed.document.nodes).length).toBeGreaterThan(1);
  });

  it('generates clean TSX without embedded designer JSON markers', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).not.toContain('/*__DESIGNER_JSON_START__');
    expect(tsx).not.toContain('__DESIGNER_JSON_END__*/');
    expect(tsx).toContain('export const GeneratedComponent');
    expect(generateDesignerTsxDisplay(state.document, state.bindingDefinitions)).toBe(tsx);
  });

  it('writes designer metadata to a separate meta payload', () => {
    const state = createPopulatedState();
    const meta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(meta);

    expect(parsed.document.id).toBe(state.document.id);
    expect(Object.keys(parsed.document.nodes).length).toBeGreaterThan(1);
  });

  it('generates optional TypeScript props sidecar', async () => {
    const { generateDesignerTypesTs } = await import('../codegen');
    const state = createPopulatedState();
    const typesTs = generateDesignerTypesTs(state.document, state.bindingDefinitions);

    expect(typesTs).toContain('export type GeneratedComponentProps');
    const { transform } = await import('esbuild');
    await expect(transform(typesTs, { loader: 'ts' })).resolves.toBeDefined();
  });

  it('syncs display TSX when the current document is provided', () => {
    const state = createPopulatedState();
    const displayTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const result = syncCodeToCanvas({
      format: 'tsx',
      code: displayTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.rootNodeId).toBe(state.document.rootNodeId);
      expect(Object.keys(result.document.nodes).length).toBeGreaterThan(1);
    }
  });

  it('parses exported JSON payload back to document shape', () => {
    const state = createPopulatedState();
    const json = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(json);

    expect(parsed.document.rootNodeId).toBe(state.document.rootNodeId);
    expect(Object.keys(parsed.document.nodes)).toEqual(Object.keys(state.document.nodes));
  });

  it('parses generated TSX by reading the meta sidecar payload', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const meta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
    const parsed = parseDesignerTsxPair(tsx, meta);

    expect(parsed.document.id).toBe(state.document.id);
    expect(Object.keys(parsed.document.nodes).length).toBeGreaterThan(1);
  });

  it('returns parse diagnostics when JSON payload is invalid', () => {
    const result = syncCodeToCanvas({ format: 'json', code: '{bad json' });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.diagnostics[0].code).toBe('parse-json');
    }
  });

  it('syncs TSX payload back to canvas shape when meta sidecar context is provided', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.rootNodeId).toBe(state.document.rootNodeId);
      expect(Object.keys(result.document.nodes).length).toBeGreaterThan(1);
    }
  });

  it('preserves apiRef retry policy fields across JSON round-trip', () => {
    const state = createPopulatedState();
    const withBinding = designerReducer(state, {
      type: 'set-binding-definition',
      bindingKey: 'api.customer.list',
      definition: {
        sourceType: 'apiRef',
        endpointRef: '/api/customers',
        requestConfig: {
          method: 'GET',
          query: { page: '1' },
        },
        retryPolicy: {
          maxAttempts: 3,
          retryDelayMs: 150,
          retryOnStatuses: [429, 503],
        },
      },
    });

    const json = generateDesignerJsonString(withBinding.document, withBinding.bindingDefinitions);
    const parsed = parseDesignerJson(json);

    expect(parsed.bindingDefinitions.definitions['api.customer.list']).toMatchObject({
      endpointRef: '/api/customers',
      retryPolicy: {
        maxAttempts: 3,
        retryDelayMs: 150,
        retryOnStatuses: [429, 503],
      },
    });
  });

  it('returns parse diagnostics when TSX sync lacks an active document', () => {
    const result = syncCodeToCanvas({ format: 'tsx', code: 'export const X = () => <div />;' });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.diagnostics[0].code).toBe('parse-tsx');
    }
  });

  it('strips runtime diagnostics from exported JSON payloads', () => {
    const state = createPopulatedState();
    const textNodeId = Object.values(state.document.nodes).find((node) => node.type === 'text')?.id;
    expect(textNodeId).toBeTruthy();

    const withDiagnostics = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: textNodeId as string,
      key: 'text',
      value: '',
    });

    expect(withDiagnostics.document.diagnostics.length).toBeGreaterThan(0);

    const json = generateDesignerJsonString(withDiagnostics.document, withDiagnostics.bindingDefinitions);
    const parsed = JSON.parse(json);

    expect(parsed.document.diagnostics).toEqual([]);
  });

  it('round-trips generated TSX through meta sidecar without losing nodes', () => {
    const state = createPopulatedState();
    const originalTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const originalMeta = generateDesignerTsxMeta(state.document, state.bindingDefinitions);
    const parsed = parseDesignerTsxPair(originalTsx, originalMeta);
    const regeneratedTsx = generateDesignerTsx(parsed.document, parsed.bindingDefinitions);
    const regeneratedMeta = generateDesignerTsxMeta(parsed.document, parsed.bindingDefinitions);
    const reparsed = parseDesignerTsxPair(regeneratedTsx, regeneratedMeta);

    expect(Object.keys(reparsed.document.nodes).sort()).toEqual(Object.keys(state.document.nodes).sort());
  });

  it('rejects unsupported export schema versions', () => {
    expect(() => parseDesignerJson(JSON.stringify({
      schema: 'legacy-export',
      version: '1.0.0',
      document: { rootNodeId: 'root', nodes: {} },
    }))).toThrow(/Unsupported designer export schema/);
  });

  it('preserves form-submit binding fields when round-tripping JSON through the code tab', () => {
    const exportJson = JSON.stringify({
      schema: 'component-designer-export',
      version: '1.0.0',
      document: {
        schemaVersion: '1.0.0',
        id: 'draft-1',
        name: 'submit-form',
        rootNodeId: 'root',
        nodes: {
          root: { id: 'root', type: 'root', parentId: null, order: 0, props: {}, layout: {}, binding: {}, children: ['form'] },
          form: {
            id: 'form',
            type: 'container',
            parentId: 'root',
            order: 0,
            props: { _designerPaletteItemId: 'html.form' },
            layout: {},
            binding: {
              regionDataSource: {
                sourceType: 'static',
                dataSourceRef: 'users',
                sourcePath: 'users',
                loadOperation: 'detail',
                urlParams: { id: 'selection.id' },
              },
            },
            children: ['save'],
          },
          save: {
            id: 'save',
            type: 'link',
            parentId: 'form',
            order: 0,
            props: { _designerPaletteItemId: 'heroui.button-solid', text: 'save' },
            layout: {},
            binding: {
              'event:onClick': {
                sourceType: 'apiRef',
                bindingRole: 'event',
                targetEvent: 'onClick',
                regionSubmit: true,
                invalidateQueries: ['region:users'],
                debounceMs: 250,
                payloadFieldTransforms: { age: 'number' },
                trueActions: [{ id: 'da_1', type: 'refreshDataSource', dataSourceRef: 'users' }],
              },
            },
            children: [],
          },
        },
      },
      bindingDefinitions: { definitions: {}, storeSegments: {}, dataSources: {}, lovs: {} },
    });

    const parsed = parseDesignerJson(exportJson);
    const clickBinding = parsed.document.nodes.save.binding['event:onClick'];
    expect(clickBinding.regionSubmit).toBe(true);
    expect(clickBinding.invalidateQueries).toEqual(['region:users']);
    expect(clickBinding.debounceMs).toBe(250);
    expect(clickBinding.payloadFieldTransforms).toEqual({ age: 'number' });
    expect(clickBinding.trueActions).toEqual([
      { id: 'da_1', type: 'refreshDataSource', dataSourceRef: 'users' },
    ]);

    const regionBinding = parsed.document.nodes.form.binding.regionDataSource;
    expect(regionBinding.loadOperation).toBe('detail');
    expect(regionBinding.dataSourceRef).toBe('users');
    expect(regionBinding.urlParams).toEqual({ id: 'selection.id' });
  });
});
