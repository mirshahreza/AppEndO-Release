/**
 * @vitest-environment jsdom
 * Phase T1-28 — Feedback & Status palette audit regression tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const FEEDBACK_ITEM_IDS = [
  'feedback.alert',
  'feedback.banner',
  'feedback.empty-state',
  'feedback.result',
] as const;

const DEFAULT_TEXT_SNIPPETS: Record<(typeof FEEDBACK_ITEM_IDS)[number], string> = {
  'feedback.alert': 'Heads up',
  'feedback.banner': 'Maintenance window',
  'feedback.empty-state': 'No records yet',
  'feedback.result': 'Success',
};

const SCOPED_INSPECTOR_FIELDS: Record<(typeof FEEDBACK_ITEM_IDS)[number], string[]> = {
  'feedback.alert': ['title', 'message', 'variant'],
  'feedback.banner': ['title', 'message', 'variant'],
  'feedback.empty-state': ['title', 'description', 'actionLabel'],
  'feedback.result': ['title', 'description', 'status'],
};

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

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

describe('T1-28 Feedback & Status palette audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(FEEDBACK_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(FEEDBACK_ITEM_IDS)(
    'renders %s with empty and very long field values without throwing',
    (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const longString = 'X'.repeat(500);

      for (const key of SCOPED_INSPECTOR_FIELDS[itemId]) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key, value: '' });
      }
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
      cleanup();

      for (const key of SCOPED_INSPECTOR_FIELDS[itemId]) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key, value: longString });
      }
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
    },
  );

  it.each(FEEDBACK_ITEM_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(FEEDBACK_ITEM_IDS)('has no matrix binding obligations for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.bindingStatus).toBe('none');
    expect(row?.supportedCapabilities).toEqual([]);
  });

  it.each(FEEDBACK_ITEM_IDS)(
    'shows default content for %s in canvas preview',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      expect(container.textContent).toContain(DEFAULT_TEXT_SNIPPETS[itemId]);
    },
  );

  it.each(FEEDBACK_ITEM_IDS)(
    'exposes only scoped inspector fields for %s (no dead fields)',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const keys = collectInspectorFieldKeys(state, nodeId);
      const expected = SCOPED_INSPECTOR_FIELDS[itemId];

      for (const key of expected) {
        expect(keys, `${itemId} should expose ${key}`).toContain(key);
      }

      const deadByItem: Record<(typeof FEEDBACK_ITEM_IDS)[number], string[]> = {
        'feedback.alert': ['description', 'status', 'actionLabel'],
        'feedback.banner': ['description', 'status', 'actionLabel'],
        'feedback.empty-state': ['message', 'variant', 'status'],
        'feedback.result': ['message', 'variant', 'actionLabel'],
      };

      for (const deadKey of deadByItem[itemId]) {
        expect(keys, `${itemId} should not expose dead field ${deadKey}`).not.toContain(deadKey);
      }
    },
  );

  it('reflects feedback.alert title, message, and variant in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.alert');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Payment failed',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'message',
      value: 'Retry with another card.',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'variant',
      value: 'danger',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Payment failed');
    expect(alert?.textContent).toContain('Retry with another card.');
    expect(alert?.className).toContain('border-rose-200');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalAlert');
    expect(tsx).toContain('title="Payment failed"');
    expect(tsx).toContain('message="Retry with another card."');
    expect(tsx).toContain('variant="danger"');
  });

  it('renders feedback.banner centered with variant tone in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.banner');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'variant',
      value: 'success',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const banner = container.querySelector('[role="alert"]');
    expect(banner?.className).toContain('text-center');
    expect(banner?.className).toContain('border-emerald-200');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalBanner');
    expect(tsx).toContain('variant="success"');
  });

  it('reflects feedback.empty-state copy and action label in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.empty-state');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'No invoices',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'description',
      value: 'Create your first invoice to see it here.',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'actionLabel',
      value: 'Create invoice',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('No invoices');
    expect(container.textContent).toContain('Create your first invoice to see it here.');
    expect(container.textContent).toContain('Create invoice');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalEmptyState');
    expect(tsx).toContain('title="No invoices"');
    expect(tsx).toContain('description="Create your first invoice to see it here."');
    expect(tsx).toContain('actionLabel="Create invoice"');
  });

  it('hides feedback.empty-state action chip when actionLabel is cleared', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.empty-state');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'actionLabel',
      value: '',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('.bg-primary')).toBeNull();
  });

  it('reflects feedback.result error status in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.result');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Upload failed',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'description',
      value: 'The file exceeds the 10 MB limit.',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'status',
      value: 'error',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Upload failed');
    expect(container.textContent).toContain('The file exceeds the 10 MB limit.');
    expect(container.querySelector('.text-rose-600')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalResult');
    expect(tsx).toContain('title="Upload failed"');
    expect(tsx).toContain('description="The file exceeds the 10 MB limit."');
    expect(tsx).toContain('status="error"');
  });

  it('renders feedback.alert with empty title and very long message without breaking layout', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.alert');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const longMessage = 'A'.repeat(500);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: '',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'message',
      value: longMessage,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toBe(longMessage);
    expect(alert?.querySelector('.font-semibold')).toBeNull();
  });
});
