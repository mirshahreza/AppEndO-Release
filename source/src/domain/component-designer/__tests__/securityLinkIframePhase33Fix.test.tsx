/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit per-element §14 #2, #3):
 * - html.link: No auto-injection of `rel="noopener noreferrer"` when `target="_blank"`,
 *   leaving every published page vulnerable to Reverse Tabnabbing.
 *   Fixed in designerRuntimePreview.tsx + tsxNodeRenderer.ts: auto-inject safe default
 *   when target is _blank and user hasn't set an explicit rel.
 *
 * - html.iframe: No `sandbox` attribute at all — iframes rendered without any restriction.
 *   No `loading` attribute either.
 *   Fixed in catalog.ts, inspectorPaletteFields.ts, designerRuntimePreview.tsx,
 *   tsxNodeRenderer.ts: added sandbox (default: "allow-scripts allow-same-origin")
 *   and loading (default: "lazy") fields.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState): string => {
  const root = state.document.nodes[state.document.rootNodeId];
  return root.children[root.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

describe('Phase 33 — html.link rel=noopener + html.iframe sandbox', () => {
  afterEach(() => {
    cleanup();
  });

  // ─── html.link ────────────────────────────────────────────

  describe('html.link auto rel="noopener noreferrer"', () => {
    it('Preview: target="_blank" with no explicit rel → rel="noopener noreferrer"', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_blank');
      state = setProp(state, nodeId, 'rel', '');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const anchor = container.querySelector('a');
      expect(anchor).not.toBeNull();
      expect(anchor!.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('Preview: target="_blank" with explicit rel → user value preserved', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_blank');
      state = setProp(state, nodeId, 'rel', 'nofollow');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const anchor = container.querySelector('a');
      expect(anchor!.getAttribute('rel')).toBe('nofollow');
    });

    it('Preview: target="_self" → no auto-injected rel', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_self');
      state = setProp(state, nodeId, 'rel', '');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const anchor = container.querySelector('a');
      expect(anchor!.getAttribute('rel')).toBeNull();
    });

    it('Export: target="_blank" with no explicit rel → rel="noopener noreferrer" in TSX', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_blank');
      state = setProp(state, nodeId, 'rel', '');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('rel="noopener noreferrer"');
    });

    it('Export: target="_blank" with explicit rel → user value preserved in TSX', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_blank');
      state = setProp(state, nodeId, 'rel', 'nofollow');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('rel="nofollow"');
      expect(tsx).not.toContain('noopener');
    });

    it('Export: target="_self" → no auto-injected rel in TSX', () => {
      let state = insertItem(createInitialDesignerState(), 'html.link');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'target', '_self');
      state = setProp(state, nodeId, 'rel', '');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).not.toContain('rel="noopener');
    });
  });

  // ─── html.iframe ──────────────────────────────────────────

  describe('html.iframe sandbox + loading', () => {
    it('Preview: default iframe has sandbox attribute', () => {
      const state = insertItem(createInitialDesignerState(), 'html.iframe');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe!.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    });

    it('Preview: default iframe has loading="lazy"', () => {
      const state = insertItem(createInitialDesignerState(), 'html.iframe');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const iframe = container.querySelector('iframe');
      expect(iframe!.getAttribute('loading')).toBe('lazy');
    });

    it('Preview: custom sandbox value is respected', () => {
      let state = insertItem(createInitialDesignerState(), 'html.iframe');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'sandbox', 'allow-scripts allow-forms');

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const iframe = container.querySelector('iframe');
      expect(iframe!.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    });

    it('Export: default iframe TSX includes sandbox and loading', () => {
      const state = insertItem(createInitialDesignerState(), 'html.iframe');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('sandbox="allow-scripts allow-same-origin"');
      expect(tsx).toContain('loading="lazy"');
    });

    it('Export: custom sandbox value appears in TSX', () => {
      let state = insertItem(createInitialDesignerState(), 'html.iframe');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'sandbox', 'allow-popups');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('sandbox="allow-popups"');
    });

    it('Export: loading="eager" appears in TSX', () => {
      let state = insertItem(createInitialDesignerState(), 'html.iframe');
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'loading', 'eager');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('loading="eager"');
    });
  });
});
