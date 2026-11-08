import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_TEMPLATE_ROOT_PROP,
  canInsertTemplateSeeds,
  cloneTemplateSeedsToNodes,
} from '../builtInTemplateClone';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { TemplateNodeSeed } from '../types';

const sampleTemplate: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'layout.flex-row',
    props: { className: 'flex flex-row gap-3' },
    children: [
      {
        type: 'text',
        paletteItemId: 'html.text',
        props: { text: 'Hello', className: 'text-sm text-default-700' },
      },
    ],
  },
];

describe('builtInTemplateClone', () => {
  it('clones template seeds with fresh ids and remapped parent/child links', () => {
    const first = cloneTemplateSeedsToNodes(sampleTemplate, 'root', 0);
    const second = cloneTemplateSeedsToNodes(sampleTemplate, 'root', 0);

    expect(first.rootNodeIds).toHaveLength(1);
    expect(second.rootNodeIds).toHaveLength(1);
    expect(first.rootNodeIds[0]).not.toBe(second.rootNodeIds[0]);

    const root = first.nodes[first.rootNodeIds[0] as string];
    expect(root.parentId).toBe('root');
    expect(root.props._designerPaletteItemId).toBe('layout.flex-row');
    expect(root.props[BUILT_IN_TEMPLATE_ROOT_PROP]).toBe(true);
    expect(root.children).toHaveLength(1);

    const child = first.nodes[root.children[0] as string];
    expect(child.parentId).toBe(root.id);
    expect(child.props.text).toBe('Hello');
    expect(child.props[BUILT_IN_TEMPLATE_ROOT_PROP]).toBeUndefined();
  });

  it('inserts built-in templates through the designer reducer without id collisions', () => {
    const initial = createInitialDesignerState();
    const firstInsert = designerReducer(initial, {
      type: 'insert-built-in-template',
      templateRoots: sampleTemplate,
      parentId: initial.document.rootNodeId,
    });
    const secondInsert = designerReducer(firstInsert, {
      type: 'insert-built-in-template',
      templateRoots: sampleTemplate,
      parentId: firstInsert.document.rootNodeId,
      index: 1,
    });

    const rootChildren = secondInsert.document.nodes[secondInsert.document.rootNodeId].children;
    expect(rootChildren).toHaveLength(2);

    const firstRoot = secondInsert.document.nodes[rootChildren[0] as string];
    const secondRoot = secondInsert.document.nodes[rootChildren[1] as string];
    expect(firstRoot.id).not.toBe(secondRoot.id);
    expect(firstRoot.props.twGap).toBe('gap-3');
  });

  it('allows built-in template drops into standard containers', () => {
    const initial = createInitialDesignerState();
    const withContainer = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const containerId = withContainer.document.nodes[withContainer.document.rootNodeId].children[0];
    const container = withContainer.document.nodes[containerId];

    expect(canInsertTemplateSeeds(sampleTemplate, container)).toBe(true);
  });

  it('strips built-in template metadata from generated TSX', () => {
    const initial = createInitialDesignerState();
    const withTemplate = designerReducer(initial, {
      type: 'insert-built-in-template',
      templateRoots: sampleTemplate,
      parentId: initial.document.rootNodeId,
    });

    const generated = generateDesignerTsx(withTemplate.document, withTemplate.bindingDefinitions);
    const jsxBody = generated.slice(generated.indexOf('export const GeneratedComponent'));

    expect(jsxBody).not.toContain(BUILT_IN_TEMPLATE_ROOT_PROP);
    expect(jsxBody).not.toContain('_designerPaletteItemId');
    expect(jsxBody).toContain('Hello');
  });
});
