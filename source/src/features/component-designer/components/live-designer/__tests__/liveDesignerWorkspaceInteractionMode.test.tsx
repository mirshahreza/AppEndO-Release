// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createInitialDesignerState, designerReducer } from '../../../../../domain/component-designer/state';
import { loadComponentDesignerVersion } from '../../../../../shared/api/queries/component-designer';
import { LiveDesignerWorkspace } from '../LiveDesignerWorkspace';

const sampleState = createInitialDesignerState('probe');

vi.mock('../../../hooks/useLiveDesignerShellHeader', () => ({
  useLiveDesignerShellHeader: vi.fn(),
}));

vi.mock('../../../../../shared/api/queries/aiModels', () => ({
  useAiSettingsQuery: () => ({ data: { enabled: false } }),
}));

vi.mock('../LiveDesignerPreview', () => ({
  LiveDesignerPreview: () => <div data-testid="live-designer-preview" />,
}));

vi.mock('../LiveDesignerViewport', () => ({
  LiveDesignerViewport: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="live-designer-viewport">{children}</div>
  ),
}));

vi.mock('../LiveDesignerToolboxPanel', () => ({
  LiveDesignerToolboxPanel: () => null,
}));

vi.mock('../LiveDesignerOutlinePanel', () => ({
  LiveDesignerOutlinePanel: () => <div data-testid="live-designer-outline-panel" />,
}));

vi.mock('../LiveDesignerPropertiesPanel', () => ({
  LiveDesignerPropertiesPanel: () => <div data-testid="live-designer-properties-panel" />,
}));

vi.mock('../LiveDesignerCodePanel', () => ({
  LiveDesignerCodePanel: () => <div data-testid="live-designer-code-panel" />,
}));

vi.mock('../../../../../shared/api/queries/component-designer', () => ({
  componentDesignerQueryKeys: { all: ['component-designer'], drafts: () => ['component-designer', 'drafts'] },
  invalidateDesignerPublishedViews: vi.fn(),
  loadComponentDesignerVersion: vi.fn(async () => ({
    id: 'draft-1',
    name: 'probe',
    document: sampleState.document,
    bindingDefinitions: sampleState.bindingDefinitions,
    workspace: { viewport: sampleState.viewport },
  })),
  updateComponentDesignerVersion: vi.fn(),
}));

vi.mock('../../../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../shared/ui')>();
  return {
    ...actual,
    WorkspaceVerticalSplitHandle: () => <div data-testid="split-handle" />,
  };
});

afterEach(() => {
  cleanup();
});

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LiveDesignerWorkspace componentPath="probe" draftId="draft-1" onBack={vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('LiveDesignerWorkspace interact mode', () => {
  it('clears the inspect selection when switching to Interact', async () => {
    renderWorkspace();

    const selection = await screen.findByTestId('live-designer-selection-label');
    expect(selection).toHaveTextContent('root · root');

    fireEvent.click(screen.getByRole('button', { name: 'Interaction mode' }));
    fireEvent.click(screen.getByRole('option', { name: 'Interact' }));

    expect(screen.queryByTestId('live-designer-selection-label')).toBeNull();
    expect(screen.getByTestId('live-designer-footer')).toHaveTextContent('Press Esc or I to inspect');
  });

  it('Ctrl+A selects all top-level canvas objects and blocks browser text select', async () => {
    let built = createInitialDesignerState('probe');
    const rootId = built.document.rootNodeId;
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const children = built.document.nodes[rootId].children;
    vi.mocked(loadComponentDesignerVersion).mockResolvedValueOnce({
      id: 'draft-1',
      name: 'probe',
      document: built.document,
      bindingDefinitions: built.bindingDefinitions,
      workspace: { viewport: built.viewport },
      metadata: {
        createdAt: built.document.metadata.createdAt,
        updatedAt: built.document.metadata.updatedAt,
      },
    });

    renderWorkspace();
    await screen.findByTestId('live-designer-selection-label');

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(children).toHaveLength(2);
    await waitFor(() => {
      expect(screen.getByTestId('live-designer-selection-label')).toHaveTextContent('2 objects');
    });
  });

  it('Ctrl+A on an empty canvas clears the root selection without selecting page text', async () => {
    renderWorkspace();
    await screen.findByTestId('live-designer-selection-label');

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(screen.queryByTestId('live-designer-selection-label')).toBeNull();
    });
    expect(screen.getByTestId('live-designer-footer')).toHaveTextContent('Ctrl+A select all');
  });

  it('Ctrl+A still selects canvas objects when toolbox search is focused', async () => {
    let built = createInitialDesignerState('probe');
    const rootId = built.document.rootNodeId;
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    vi.mocked(loadComponentDesignerVersion).mockResolvedValueOnce({
      id: 'draft-1',
      name: 'probe',
      document: built.document,
      bindingDefinitions: built.bindingDefinitions,
      workspace: { viewport: built.viewport },
      metadata: {
        createdAt: built.document.metadata.createdAt,
        updatedAt: built.document.metadata.updatedAt,
      },
    });

    renderWorkspace();
    await screen.findByTestId('live-designer-selection-label');

    const search = document.createElement('input');
    search.placeholder = 'toolbox…';
    document.body.appendChild(search);
    search.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(search);
    await waitFor(() => {
      expect(screen.getByTestId('live-designer-selection-label')).toHaveTextContent('2 objects');
    });
  });

  it('Delete after Ctrl+A removes every selected canvas object', async () => {
    let built = createInitialDesignerState('probe');
    const rootId = built.document.rootNodeId;
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    built = designerReducer(built, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    vi.mocked(loadComponentDesignerVersion).mockResolvedValueOnce({
      id: 'draft-1',
      name: 'probe',
      document: built.document,
      bindingDefinitions: built.bindingDefinitions,
      workspace: { viewport: built.viewport },
      metadata: {
        createdAt: built.document.metadata.createdAt,
        updatedAt: built.document.metadata.updatedAt,
      },
    });

    renderWorkspace();
    await screen.findByTestId('live-designer-selection-label');

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await waitFor(() => {
      expect(screen.getByTestId('live-designer-selection-label')).toHaveTextContent('2 objects');
    });

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    }));
    await waitFor(() => {
      expect(screen.getByTestId('live-designer-selection-label')).toHaveTextContent('root · root');
    });
  });
});

