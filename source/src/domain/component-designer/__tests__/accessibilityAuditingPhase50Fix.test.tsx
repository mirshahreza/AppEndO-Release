/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis #19 / Phase 50): DesignerDiagnostic had no `a11y-*` codes;
 * accessibility checks only lived as an ad-hoc PreviewViewport helper, not in validation.ts
 * or the Diagnostics panel filters.
 * Fixed in a11yDiagnostics.ts / validation.ts / types.ts / DesignerDiagnosticsPanel.tsx:
 * parallel a11y category (missing-alt, low-contrast, missing-aria-label, heading-order)
 * with Errors / Warnings / Accessibility filters.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  collectAccessibilityDiagnostics,
  contrastRatio,
  filterDiagnosticsByCategory,
  getDesignerDiagnosticCategory,
} from '../a11yDiagnostics';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerDocument } from '../validation';
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../types';
import { DesignerDiagnosticsPanel } from '../../../features/component-designer/components/DesignerDiagnosticsPanel';
afterEach(cleanup);

const makeNode = (partial: Partial<DesignerNode> & Pick<DesignerNode, 'id' | 'type'>): DesignerNode => ({
  parentId: 'root',
  order: 0,
  props: {},
  layout: {},
  binding: {},
  children: [],
  ...partial,
});

const withNodes = (nodes: Record<string, DesignerNode>): DesignerDocument => {
  const state = createInitialDesignerState();
  const rootId = state.document.rootNodeId;
  const childIds = Object.keys(nodes).filter((id) => id !== rootId);
  return {
    ...state.document,
    nodes: {
      ...state.document.nodes,
      [rootId]: {
        ...state.document.nodes[rootId],
        children: childIds,
      },
      ...nodes,
    },
  };
};

describe('Phase 50 — Accessibility Auditing in Diagnostics', () => {
  it('html.image without alt produces exactly one a11y-missing-alt diagnostic', () => {
    const document = withNodes({
      img1: makeNode({
        id: 'img1',
        type: 'image',
        props: { _designerPaletteItemId: 'html.image', src: '/x.png' },
      }),
    });

    const a11y = collectAccessibilityDiagnostics(document).filter((d) => d.code === 'a11y-missing-alt');
    expect(a11y).toHaveLength(1);
    expect(a11y[0]?.nodeId).toBe('img1');
    expect(a11y[0]?.field).toBe('alt');

    const fromValidate = validateDesignerDocument(document).filter((d) => d.code === 'a11y-missing-alt');
    expect(fromValidate).toHaveLength(1);
  });

  it('decorative empty alt string does not emit a11y-missing-alt', () => {
    const document = withNodes({
      img1: makeNode({
        id: 'img1',
        type: 'image',
        props: { _designerPaletteItemId: 'html.image', src: '/x.png', alt: '' },
      }),
    });
    expect(collectAccessibilityDiagnostics(document).filter((d) => d.code === 'a11y-missing-alt')).toHaveLength(0);
  });

  it('flags a11y-missing-aria-label for nameless button and unlabeled input', () => {
    const document = withNodes({
      btn1: makeNode({ id: 'btn1', type: 'button', props: {}, order: 0 }),
      input1: makeNode({
        id: 'input1',
        type: 'field',
        order: 1,
        props: { _designerPaletteItemId: 'heroui.input-text' },
      }),
    });
    const codes = collectAccessibilityDiagnostics(document).map((d) => d.code);
    expect(codes.filter((c) => c === 'a11y-missing-aria-label')).toHaveLength(2);
  });

  it('flags a11y-low-contrast when text/background hex pair is below 4.5:1', () => {
    expect(contrastRatio('#777777', '#ffffff')).not.toBeNull();
    expect(contrastRatio('#777777', '#ffffff')!).toBeLessThan(4.5);

    const document = withNodes({
      text1: makeNode({
        id: 'text1',
        type: 'text',
        props: {
          text: 'Low contrast',
          className: 'text-[#777777] bg-[#ffffff]',
        },
      }),
    });
    const low = collectAccessibilityDiagnostics(document).filter((d) => d.code === 'a11y-low-contrast');
    expect(low).toHaveLength(1);
    expect(low[0]?.nodeId).toBe('text1');
  });

  it('flags a11y-low-contrast when inline style hex pair is below 4.5:1', () => {
    const bad = withNodes({
      text1: makeNode({
        id: 'text1',
        type: 'text',
        props: {
          text: 'Muted',
          style: { color: '#cccccc', backgroundColor: '#ffffff' },
        },
      }),
    });
    expect(collectAccessibilityDiagnostics(bad).some((d) => d.code === 'a11y-low-contrast')).toBe(true);
  });

  it('flags a11y-heading-order when heading levels skip', () => {
    const document = withNodes({
      h1: makeNode({
        id: 'h1',
        type: 'heading',
        order: 0,
        props: { _designerPaletteItemId: 'html.heading', text: 'Title', level: 'h1' },
      }),
      h3: makeNode({
        id: 'h3',
        type: 'heading',
        order: 1,
        props: { _designerPaletteItemId: 'html.heading', text: 'Skipped', level: 'h3' },
      }),
    });
    const orderIssues = collectAccessibilityDiagnostics(document).filter((d) => d.code === 'a11y-heading-order');
    expect(orderIssues).toHaveLength(1);
    expect(orderIssues[0]?.nodeId).toBe('h3');
  });

  it('a11y diagnostics are a parallel category and do not change Errors/Warnings counts', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: state.document.rootNodeId,
    });
    const baseline = validateDesignerDocument(state.document);
    const baselineErrors = filterDiagnosticsByCategory(baseline, 'errors');
    const baselineWarnings = filterDiagnosticsByCategory(baseline, 'warnings');

    // Inject an image missing alt into the same document shape.
    const containerId = state.document.nodes[state.document.rootNodeId].children[0];
    const withImage: DesignerDocument = {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        img_missing: makeNode({
          id: 'img_missing',
          type: 'image',
          parentId: containerId,
          props: { _designerPaletteItemId: 'html.image', src: '/a.png' },
        }),
        [containerId]: {
          ...state.document.nodes[containerId],
          children: [...state.document.nodes[containerId].children, 'img_missing'],
        },
      },
    };

    const next = validateDesignerDocument(withImage);
    expect(filterDiagnosticsByCategory(next, 'errors')).toEqual(baselineErrors);
    expect(filterDiagnosticsByCategory(next, 'warnings')).toEqual(baselineWarnings);
    expect(filterDiagnosticsByCategory(next, 'accessibility').some((d) => d.code === 'a11y-missing-alt')).toBe(true);
  });

  it('Diagnostics panel exposes Errors / Warnings / Accessibility filters', () => {
    const diagnostics: DesignerDiagnostic[] = [
      {
        id: 'e1',
        code: 'required-prop',
        level: 'error',
        message: 'Required prop missing',
        nodeId: 'n1',
      },
      {
        id: 'w1',
        code: 'document-large',
        level: 'warning',
        message: 'Document is large',
      },
      {
        id: 'a1',
        code: 'a11y-missing-alt',
        level: 'warning',
        message: 'Image is missing alt',
        nodeId: 'img1',
      },
    ];

    expect(getDesignerDiagnosticCategory(diagnostics[2]!)).toBe('accessibility');

    render(<DesignerDiagnosticsPanel diagnostics={diagnostics} />);
    expect(screen.getByTestId('designer-diagnostics-filter-errors')).toHaveTextContent('Errors');
    expect(screen.getByTestId('designer-diagnostics-filter-warnings')).toHaveTextContent('Warnings');
    expect(screen.getByTestId('designer-diagnostics-filter-accessibility')).toHaveTextContent('Accessibility');

    // Default tab is Errors
    expect(screen.getByTestId('designer-diagnostics-list-errors')).toBeTruthy();
    expect(screen.getByTestId('designer-diagnostic-e1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('designer-diagnostics-filter-accessibility'));
    expect(screen.getByTestId('designer-diagnostics-list-accessibility')).toBeTruthy();
    expect(screen.getByTestId('designer-diagnostic-a1')).toBeTruthy();
    expect(screen.queryByTestId('designer-diagnostic-e1')).toBeNull();
  });
});
