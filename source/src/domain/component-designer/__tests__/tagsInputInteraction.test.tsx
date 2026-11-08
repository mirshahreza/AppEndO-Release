/**
 * @vitest-environment jsdom
 *
 * heroui.tags-input was listed as eventComplete:false. The actual gap was deeper
 * than a missing wire-up: DesignerRuntimeTagsInput rendered tags read-only with no
 * way to add or remove one at all (no input field, no remove button) — the widget
 * had no interactive functionality whatsoever in the live canvas.
 *
 * Preview fix: DesignerRuntimeTagsInput now uses real local React state (hooks are
 * natural there).
 *
 * Codegen fix (cluster G close-out): the codegen pipeline generates the whole
 * exported component as one flat function body via string concatenation, and
 * previously had no established pattern for giving one leaf widget its own local
 * interactive state (Select/Switch/Slider dodge this by being uncontrolled
 * single-value adapters, which doesn't work for an add/remove array). This is now
 * solved by extending codegen.ts's existing `hookDefinitionLines`/preamble
 * mechanism (previously only used for API-fetch hooks): `generateDesignerTsx` now
 * also appends `renderTagsInputStatePreambleLines` (tsxParityPalette.ts) to the
 * component preamble, which declares one `useState<string[]>` (+ draft input state
 * + add/remove callbacks) per heroui.tags-input node in the document, scoped by
 * node id. `renderTagsInputParityJsx` renders a real `<input type="text">` wired to
 * those callbacks (Enter/blur to add, Backspace to pop the last tag) and a remove
 * button per tag — matching DesignerRuntimeTagsInput's preview UX.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { createDynamicAction, visibilityStorePathForNode } from '../bindingDynamicActionsEngine';

describe('heroui.tags-input add/remove interaction (preview)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('adds a tag by typing and pressing Enter, and removes it by clicking its remove button', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tags-input',
      parentId: state.document.rootNodeId,
    });
    const tagsId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: tagsId, key: 'value', value: '' });

    render(
      renderDesignerDocumentPreview(state.document, {
        interactive: true,
        bindingDefinitions: state.bindingDefinitions,
      }) as React.ReactElement,
    );

    const input = screen.getByLabelText('Add tag');
    fireEvent.change(input, { target: { value: 'urgent' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('urgent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove urgent' }));
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
  });

  it('fires a showHide Dynamic Action bound to onChange when a tag is added', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tags-input',
      parentId: state.document.rootNodeId,
    });
    const tagsId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: tagsId, key: 'value', value: '' });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'title', value: 'Tag added' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'isOpen', value: false });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: tagsId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
    });

    const visibilityPath = visibilityStorePathForNode(modalId);
    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return renderDesignerDocumentPreview(state.document, {
        interactive: true,
        bindingDefinitions: state.bindingDefinitions,
        designerStore: store,
        onStoreChange: (updater) => {
          setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
        },
      });
    };

    render(<PreviewHarness />);
    expect(screen.queryByText('Tag added')).toBeNull();

    const input = screen.getByLabelText('Add tag');
    fireEvent.change(input, { target: { value: 'urgent' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(screen.getByText('Tag added')).toBeTruthy();
    });
    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });

  it('declares onChange as a bindable event target for form-input-set items including tags-input', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tags-input',
      parentId: state.document.rootNodeId,
    });
    const tagsId = state.document.nodes[state.document.rootNodeId].children[0]!;
    expect(resolveNodeEventBindingTargets(state.document.nodes[tagsId]!)).toEqual(
      expect.arrayContaining(['onChange']),
    );
  });

  it('exports real add/remove interaction in TSX: local useState, a text input, and a per-tag remove button', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tags-input',
      parentId: state.document.rootNodeId,
    });
    const tagsId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: tagsId, key: 'value', value: 'alpha,beta' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    // Real component-scoped useState for the tags array + draft input (not a static list).
    expect(tsx).toMatch(/const \[tagsInputTags_\w+, setTagsInputTags_\w+\] = React\.useState<string\[\]>\(\["alpha","beta"\]\);/);
    expect(tsx).toMatch(/const \[tagsInputDraft_\w+, setTagsInputDraft_\w+\] = React\.useState\(''\);/);
    // A real add function wired to Enter / blur, and a real remove function wired to a button.
    expect(tsx).toMatch(/const addTagsInputTag_\w+ = \(raw: string\) => \{/);
    expect(tsx).toMatch(/const removeTagsInputTag_\w+ = \(tag: string\) => \{/);
    // The exported JSX renders that state, not a static <Tag> list.
    expect(tsx).toMatch(/\{tagsInputTags_\w+\.map\(\(tag\) => \(/);
    expect(tsx).toContain('type="text"');
    expect(tsx).toContain("aria-label={`Remove ${tag}`}");
    expect(tsx).toMatch(/onKeyDown=\{\(event\) => \{ if \(event\.key === 'Enter'\)/);
    expect(tsx).toContain('<TagGroup');
    // esbuild-syntax-validity for this exact interactive-codegen scenario is covered by
    // generatedTsxValidity.test.ts ("compiles a document with a bound tags-input onChange
    // Interaction") — esbuild's transform() cannot run in this file's jsdom environment
    // (it needs the node environment's real TextEncoder).
  });

  it('wires a bound onChange Interaction into the exported add/remove handlers', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tags-input',
      parentId: state.document.rootNodeId,
    });
    const tagsId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: tagsId, key: 'value', value: '' });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: tagsId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const handlerName = `handleonChange_${tagsId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    // The generated onChange handler exists (Dynamic Action codegen).
    expect(tsx).toContain(`const ${handlerName} = `);
    // Both add and remove notify it with the same { target: { value } } event shape
    // DesignerRuntimeTagsInput's commitTags uses in preview — not left unwired.
    const notifyCall = `${handlerName}({ target: { value: next.join(',') } } as unknown as React.ChangeEvent<HTMLInputElement>);`;
    expect(tsx.split(notifyCall).length - 1).toBe(2);
    // TagGroup itself must not carry a raw onChange (HeroUI's TagGroup has no such prop) —
    // the handler is only ever invoked from the add/remove callbacks above.
    expect(tsx).not.toMatch(new RegExp(`<TagGroup[^>]*\\bonChange=\\{${handlerName}\\}`));
  });
});
