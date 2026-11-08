// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import { DesignerDocumentPreview } from '../../../../../domain/component-designer/designerRuntimePreview';
import { LiveDesignerPreview } from '../LiveDesignerPreview';
import { LiveDesignerPropertiesPanel } from '../LiveDesignerPropertiesPanel';
import type { DesignerAction } from '../../../../../domain/component-designer/types';

function Harness({ viaPanel, useLivePreview }: { viaPanel: boolean; useLivePreview: boolean }) {
  const [state, dispatch] = React.useReducer(designerReducer, undefined, () => {
    let next = createInitialDesignerState('live-preview-prop');
    next = designerReducer(next, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: next.document.rootNodeId,
    });
    const nodeId = next.document.nodes[next.document.rootNodeId].children[0]!;
    next = designerReducer(next, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: 'Before edit',
    });
    next = designerReducer(next, { type: 'select-node', nodeId });
    return next;
  });

  const nodeId = state.selectedNodeId!;
  const node = state.document.nodes[nodeId] ?? null;

  return (
    <div>
      <div data-testid="preview-host">
        {useLivePreview ? (
          <LiveDesignerPreview
            document={state.document}
            bindingDefinitions={state.bindingDefinitions}
          />
        ) : (
          <DesignerDocumentPreview
            document={state.document}
            bindingDefinitions={state.bindingDefinitions}
            interactive={false}
          />
        )}
      </div>
      {viaPanel ? (
        <LiveDesignerPropertiesPanel
          node={node}
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          dispatch={dispatch as React.Dispatch<DesignerAction>}
          onClose={() => undefined}
          width={320}
        />
      ) : null}
      <button
        type="button"
        data-testid="force-set-prop"
        onClick={() => {
          dispatch({
            type: 'set-node-prop',
            nodeId,
            key: 'text',
            value: 'After force',
          });
        }}
      >
        Force
      </button>
      <pre data-testid="prop-snapshot">{String(node?.props.text ?? '')}</pre>
    </div>
  );
}

describe('Live Designer preview prop sync', () => {
  afterEach(() => {
    cleanup();
  });

  it('updates DesignerDocumentPreview when set-node-prop is dispatched', async () => {
    render(<Harness viaPanel={false} useLivePreview={false} />);

    expect(screen.getByTestId('prop-snapshot')).toHaveTextContent('Before edit');
    expect(screen.getByTestId('preview-host')).toHaveTextContent('Before edit');

    fireEvent.click(screen.getByTestId('force-set-prop'));

    await waitFor(() => {
      expect(screen.getByTestId('prop-snapshot')).toHaveTextContent('After force');
      expect(screen.getByTestId('preview-host')).toHaveTextContent('After force');
    });
  });

  it('updates LiveDesignerPreview when Content Text is edited in the panel', async () => {
    render(<Harness viaPanel={true} useLivePreview={true} />);

    expect(screen.getByTestId('preview-host')).toHaveTextContent('Before edit');

    const textbox = screen.getByDisplayValue('Before edit');
    fireEvent.change(textbox, { target: { value: 'From panel' } });

    await waitFor(() => {
      expect(screen.getByTestId('prop-snapshot')).toHaveTextContent('From panel');
      expect(screen.getByTestId('preview-host')).toHaveTextContent('From panel');
      expect(screen.getByTestId('live-designer-preview')).toHaveAttribute(
        'data-document-revision',
        expect.stringMatching(/\d|T|Z|-/),
      );
    });
  });

  it('gives the preview document an h-full root so Height 100% on nodes can fill the canvas', () => {
    render(<Harness viaPanel={false} useLivePreview={true} />);
    const preview = screen.getByTestId('live-designer-preview');
    const documentRoot = preview.querySelector('.flex.h-full.min-h-0.flex-1.flex-col');
    expect(documentRoot).toBeTruthy();
    expect(documentRoot?.className).not.toMatch(/\bspace-y-3\b/);
  });
});
