import { describe, expect, it } from 'vitest';
import { attachParsedNodeSignatures, reconcileParsedJsxTree, type ParsedDesignerNodeDraft } from '../jsxNodeReconciler';
import type { DesignerDocument } from '../types';

const createBaseDocument = (): DesignerDocument => ({
  id: 'draft-1',
  name: 'Test',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['text-a', 'text-b'],
    },
    'text-a': {
      id: 'text-a',
      type: 'text',
      parentId: 'root',
      order: 0,
      props: { text: 'First', className: 'text-sm' },
      layout: {},
      binding: {
        'prop:text': {
          sourceType: 'expression',
          sourcePath: 'dataContext?.title',
        },
      },
      children: [],
    },
    'text-b': {
      id: 'text-b',
      type: 'text',
      parentId: 'root',
      order: 1,
      props: { text: 'Second', className: 'text-sm' },
      layout: {},
      binding: {},
      children: [],
    },
  },
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  diagnostics: [],
});

const createTextDraft = (text: string): ParsedDesignerNodeDraft =>
  attachParsedNodeSignatures({
    type: 'text',
    props: { text, className: 'text-sm' },
    layout: {},
    binding: {},
    children: [],
    signature: '',
  });

describe('reconcileParsedJsxTree', () => {
  it('drops stale prop bindings when JSX no longer contains dynamic expressions', () => {
    const baseDocument = createBaseDocument();
    const drafts = [
      createTextDraft('First'),
      createTextDraft('Second'),
    ];

    const reconciled = reconcileParsedJsxTree(drafts, baseDocument);
    const firstNode = reconciled.nodes['text-a'];

    expect(firstNode?.binding['prop:text']).toBeUndefined();
    expect(firstNode?.props.text).toBe('First');
  });

  it('preserves node ids by signature when identical siblings are reordered', () => {
    const baseDocument = createBaseDocument();
    const drafts = [
      createTextDraft('Second'),
      createTextDraft('First'),
    ];

    const reconciled = reconcileParsedJsxTree(drafts, baseDocument);
    const childIds = reconciled.nodes.root.children;

    expect(childIds).toEqual(['text-b', 'text-a']);
    expect(reconciled.nodes['text-a']?.props.text).toBe('First');
    expect(reconciled.nodes['text-b']?.props.text).toBe('Second');
  });
});
