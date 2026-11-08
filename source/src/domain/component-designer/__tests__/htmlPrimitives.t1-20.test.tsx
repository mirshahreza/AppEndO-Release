/**
 * @vitest-environment jsdom
 * Phase T1-20 — HTML Primitives audit regression tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { readNodePropForReactDomAttribute } from '../runtimeNodeProps';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const HTML_PRIMITIVE_IDS = [
  'html.container',
  'html.text',
  'html.heading',
  'html.link',
  'html.image',
  'html.iframe',
  'html.file-upload',
  'html.list',
  'html.list-item',
  'html.section',
  'html.article',
  'html.figure',
  'html.table-wrap',
  'html.form',
] as const;

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

describe('T1-20 HTML primitives audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(HTML_PRIMITIVE_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    let state = createInitialDesignerState();

    if (itemId === 'html.list-item') {
      state = insertItem(state, 'html.list');
      const listId = lastChildId(state, state.document.rootNodeId);
      state = insertItem(state, itemId, listId);
    } else {
      state = insertItem(state, itemId);
    }

    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(HTML_PRIMITIVE_IDS)('exports TSX for %s', (itemId) => {
    let state = createInitialDesignerState();

    if (itemId === 'html.list-item') {
      state = insertItem(state, 'html.list');
      const listId = lastChildId(state, state.document.rootNodeId);
      state = insertItem(state, itemId, listId);
    } else {
      state = insertItem(state, itemId);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  /**
   * T1-7 close-out (cluster G) spot-check: `hasInspectorFields` (toolboxInventory.ts)
   * previously only recognized membership in the dedicated field-map dictionaries, so it
   * reported `inspector:false` for these 10 items even though every one of them already had
   * a real, working Inspector surface through the generic Tailwind className system
   * (`resolveTailwindInspectorFields` falls back to the full TAILWIND_INSPECTOR_FIELDS list
   * when an item has no dedicated subset in PALETTE_TAILWIND_FIELD_KEY_MAP). Cluster A's
   * audit already confirmed this generic mechanism works end-to-end via the
   * `layout.flex-row` gap test in layoutItems.t1-21.test.tsx; this re-verifies it directly
   * for each of the specific html.* ids that were flagged, rather than trusting that
   * finding by extrapolation alone.
   */
  const GENERIC_TAILWIND_INSPECTOR_HTML_IDS = [
    'html.container',
    'html.text',
    'html.heading',
    'html.link',
    'html.list-item',
    'html.section',
    'html.article',
    'html.figure',
    'html.table-wrap',
    'html.form',
  ] as const;

  it.each(GENERIC_TAILWIND_INSPECTOR_HTML_IDS)(
    'reflects a generic Tailwind className edit for %s live in canvas preview and export TSX',
    (itemId) => {
      let state = createInitialDesignerState();
      let nodeId: string;

      if (itemId === 'html.list-item') {
        state = insertItem(state, 'html.list');
        const listId = lastChildId(state, state.document.rootNodeId);
        state = insertItem(state, itemId, listId);
        nodeId = lastChildId(state, listId);
      } else {
        state = insertItem(state, itemId);
        nodeId = lastChildId(state, state.document.rootNodeId);
      }

      const existingClassName = String(state.document.nodes[nodeId].props.className ?? '');
      const nextClassName = `${existingClassName} border-4 border-fuchsia-500`.trim();

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: nextClassName,
      });

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      expect(container.querySelector('.border-fuchsia-500'), `${itemId} preview should reflect the className edit`).toBeTruthy();

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx, `${itemId} export TSX should contain the className edit`).toContain('border-fuchsia-500');
    },
  );

  it('renders long text without breaking html.text preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const longText = 'Lorem ipsum '.repeat(80).trim();

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: longText,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Lorem ipsum');
  });

  it('reflects html.form enctype inspector value in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'enctype',
      value: 'multipart/form-data',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const form = container.querySelector('form');
    expect(form?.getAttribute('enctype')).toBe('multipart/form-data');
  });

  it('reflects html.form autocomplete inspector value in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'autocomplete',
      value: 'off',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const form = container.querySelector('form');
    expect(form?.getAttribute('autocomplete')).toBe('off');
  });

  it('emits html.form enctype and autocomplete in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'enctype',
      value: 'multipart/form-data',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'autocomplete',
      value: 'off',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('encType="multipart/form-data"');
    expect(tsx).toContain('autoComplete="off"');
  });

  it('syncs html.list static list items to child list-item nodes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.list');
    const listId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'sync-list-item-texts',
      listNodeId: listId,
      texts: ['Alpha', 'Beta', 'Gamma'],
    });

    const listNode = state.document.nodes[listId];
    expect(listNode.children).toHaveLength(3);
    for (const childId of listNode.children) {
      const child = state.document.nodes[childId];
      expect(child.type).toBe('list-item');
      expect(typeof child.props.text).toBe('string');
    }

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Alpha');
    expect(container.textContent).toContain('Beta');
    expect(container.textContent).toContain('Gamma');
  });

  it('exports semantic section/article/figure/form tags', () => {
    const containerIds = ['html.section', 'html.article', 'html.figure', 'html.form'] as const;
    let state = createInitialDesignerState();

    for (const itemId of containerIds) {
      state = insertItem(state, itemId);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<section');
    expect(tsx).toContain('<article');
    expect(tsx).toContain('<figure');
    expect(tsx).toContain('<form');
  });

  it('exports html.image objectFit and fallbackSrc handlers', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'objectFit',
      value: 'cover',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'fallbackSrc',
      value: '/assets/fallback.svg',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain("objectFit: 'cover'");
    expect(tsx).toContain('onError=');
    expect(tsx).toContain('/assets/fallback.svg');
  });

  it('applies html.image fallbackSrc on error in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'src',
      value: 'https://example.invalid/missing.png',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'fallbackSrc',
      value: '/assets/fallback.svg',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    img?.dispatchEvent(new Event('error'));
    expect(img?.getAttribute('src')).toBe('/assets/fallback.svg');
  });

  it('reads aliased inspector keys for React DOM attributes', () => {
    const props = { enctype: 'multipart/form-data', autocomplete: 'off' };
    expect(readNodePropForReactDomAttribute(props, 'encType')).toBe('multipart/form-data');
    expect(readNodePropForReactDomAttribute(props, 'autoComplete')).toBe('off');
  });

  // Regression: html.link's Inspector exposes `download` and `referrerPolicy` fields
  // (inspectorRegistry.ts NODE_TAG_FIELDS.link) and codegen already emitted both generically
  // via buildNodeJsxAttributes — but designerRuntimePreview.tsx's `<a>` JSX only whitelisted
  // href/target/rel, so editing these two fields silently did nothing in the live canvas while
  // working fine in exported code (same bug class as heroui.select's onChange, doc 18 Item 4).
  it('reflects html.link download and referrerPolicy inspector values in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.link');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'download',
      value: 'report.pdf',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'referrerPolicy',
      value: 'no-referrer',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const link = container.querySelector('a');
    expect(link?.getAttribute('download')).toBe('report.pdf');
    expect(link?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('emits html.link download and referrerPolicy in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'html.link');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'download',
      value: 'report.pdf',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'referrerPolicy',
      value: 'no-referrer',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('download="report.pdf"');
    expect(tsx).toContain('referrerPolicy="no-referrer"');
  });

  // Regression: same bug class on html.image — decoding/srcSet/sizes are declared Inspector
  // fields (NODE_TAG_FIELDS.image) and already flowed through to codegen generically, but the
  // preview's `<img>` JSX only whitelisted src/alt/width/height/loading.
  it('reflects html.image decoding, srcSet, and sizes inspector values in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'decoding',
      value: 'async',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'srcSet',
      value: '/a.png 1x, /a@2x.png 2x',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'sizes',
      value: '(min-width: 768px) 50vw, 100vw',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('srcset')).toBe('/a.png 1x, /a@2x.png 2x');
    expect(img?.getAttribute('sizes')).toBe('(min-width: 768px) 50vw, 100vw');
  });

  it('emits html.image decoding, srcSet, and sizes in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'decoding',
      value: 'async',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'srcSet',
      value: '/a.png 1x, /a@2x.png 2x',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'sizes',
      value: '(min-width: 768px) 50vw, 100vw',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('decoding="async"');
    expect(tsx).toContain('srcSet="/a.png 1x, /a@2x.png 2x"');
    expect(tsx).toContain('sizes="(min-width: 768px) 50vw, 100vw"');
  });

  // Data-binding dimension (doc 18 scope item 3): html.image's src is bindable to a real
  // mock data source (a Store path here), and must resolve identically in canvas preview
  // and in exported/compiled code.
  it('binds html.image src to a store path identically in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const storeRead = createStoreReadBindingDefinition('src', 'assets.heroImage');

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: storeRead.bindingKey,
      definition: storeRead.definition,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document, {
      designerStore: { assets: { heroImage: 'https://cdn.example.com/hero.png' } },
    })}</>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/hero.png');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('designerStore?.assets?.heroImage');
  });

  // Bug found: html.image's earlier `src` binding fix (isSrcBound guard) was never applied to
  // `alt` — a bound `alt` emitted a second, duplicate `alt=` JSX attribute (TS17001: JSX
  // elements cannot have multiple attributes with the same name), failing to compile.
  it('binds html.image alt without emitting a duplicate alt attribute', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const storeRead = createStoreReadBindingDefinition('alt', 'page.imageAlt');

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: storeRead.bindingKey,
      definition: storeRead.definition,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const altAttrCount = (tsx.match(/\balt=/g) ?? []).length;
    expect(altAttrCount).toBe(1);
    expect(tsx).toContain('alt={designerStore?.page?.imageAlt}');
  });

  // Bug found: html.iframe unconditionally reserved src/title/width/height/allowFullScreen as
  // static attributes even when bound, so a bound field always emitted twice (TS17001) — the
  // exported project failed to compile whenever any iframe field was bound.
  it('binds html.iframe fields without emitting duplicate attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.iframe');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const storeRead = createStoreReadBindingDefinition('src', 'page.embedUrl');

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: storeRead.bindingKey,
      definition: storeRead.definition,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const srcAttrCount = (tsx.match(/\bsrc=/g) ?? []).length;
    expect(srcAttrCount).toBe(1);
    expect(tsx).toContain('src={designerStore?.page?.embedUrl}');
    // Unbound fields keep their static reserved defaults, unaffected by the fix.
    expect(tsx).toContain('title="Embedded content"');
  });
});
