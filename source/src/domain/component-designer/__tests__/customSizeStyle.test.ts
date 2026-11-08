import { describe, expect, it } from 'vitest';
import { resolveCustomSizeDomStyle } from '../customSizeStyle';
import { DESIGNER_GENERATED_ROOT_CLASS } from '../designerGeneratedRoot';
import { resolveDesignerDomProps } from '../domProps';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';

describe('customSizeStyle', () => {
  it('extracts width/height from arbitrary w-[…]/h-[…] utilities', () => {
    expect(resolveCustomSizeDomStyle({ props: { className: 'flex w-[320px] h-[50%]' } } as never))
      .toEqual({ width: '320px', height: '50%' });
  });

  it('returns null when no custom size utility is present', () => {
    expect(resolveCustomSizeDomStyle({ props: { className: 'flex w-full' } } as never)).toBeNull();
    expect(resolveCustomSizeDomStyle({ props: {} } as never)).toBeNull();
  });

  it('handles a width-only or height-only utility independently', () => {
    expect(resolveCustomSizeDomStyle({ props: { className: 'w-[20rem]' } } as never)).toEqual({ width: '20rem' });
    expect(resolveCustomSizeDomStyle({ props: { className: 'h-[12vh]' } } as never)).toEqual({ height: '12vh' });
  });

  it('reads important-prefixed arbitrary sizes (HeroUI promotion path)', () => {
    expect(resolveCustomSizeDomStyle({ props: { className: '!w-[320px] !h-[12vh]' } } as never)).toEqual({
      width: '320px',
      height: '12vh',
    });
  });

  it(
    'bug found: a custom width set via the Style panel previously had zero visual effect — '
    + 'resolveDesignerDomProps now merges it into the real inline style, since Tailwind can never '
    + 'generate CSS for an arbitrary runtime-assembled class like w-[357px]',
    () => {
      let state = createInitialDesignerState();
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId: 'html.container',
        parentId: state.document.rootNodeId,
      });
      const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'flex w-[357px] h-[240px]',
      });

      const domProps = resolveDesignerDomProps(state.document.nodes[nodeId]);
      expect(domProps.style).toMatchObject({ width: '357px', height: '240px' });
      // The (now-inert) class token is deliberately left in place so the Style panel's own
      // read-back parsing (extractCustomSizeValue) keeps showing the current value.
      expect(domProps.className).toContain('w-[357px]');
    },
  );

  it('a hand-typed `style` prop wins over the derived custom-size style for the same property', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'className', value: 'w-[357px]' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'style', value: 'width: 900px' });

    const domProps = resolveDesignerDomProps(state.document.nodes[nodeId]);
    expect(domProps.style).toMatchObject({ width: '900px' });
  });

  it('the exported/published TSX carries the same real width/height style, not just the canvas', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'className', value: 'w-[357px] h-[240px]' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/style=\{\{[^}]*width:\s*'357px'[^}]*\}\}/);
    expect(tsx).toMatch(/style=\{\{[^}]*height:\s*'240px'[^}]*\}\}/);
  });

  it('wraps exported TSX in an h-full root so child h-full / h-[100%] can resolve', () => {
    const state = createInitialDesignerState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain(`className="${DESIGNER_GENERATED_ROOT_CLASS}"`);
  });
});
