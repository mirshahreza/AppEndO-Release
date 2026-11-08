// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createInitialDesignerState } from '../../../../../domain/component-designer/state';
import { LiveDesignerWorkspace } from '../LiveDesignerWorkspace';

const sampleState = createInitialDesignerState('probe');

vi.mock('../../../hooks/useLiveDesignerShellHeader', () => ({
  useLiveDesignerShellHeader: vi.fn(),
}));

vi.mock('../../../../../shared/api/queries/aiModels', () => ({
  useAiSettingsQuery: () => ({ data: { enabled: true } }),
}));

vi.mock('../ClientComponentAiPanel', () => ({
  ClientComponentAiPanel: () => <div data-testid="live-designer-ai-panel" />,
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

vi.mock('../LiveDesignerFooter', () => ({
  LiveDesignerFooter: () => <div data-testid="live-designer-footer" />,
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

describe('LiveDesignerWorkspace AI dock', () => {
  it('docks the AI chat panel to the right of the canvas', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LiveDesignerWorkspace componentPath="probe" draftId="draft-1" onBack={vi.fn()} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const aiToggle = await screen.findByRole('button', { name: 'Show AI assistant' });
    expect(screen.getByRole('button', { name: 'Show Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Properties' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Code' })).toBeInTheDocument();
    fireEvent.click(aiToggle);

    await waitFor(() => {
      expect(screen.getByTestId('live-designer-ai-dock')).not.toHaveClass('hidden');
    });

    const canvas = screen.getByTestId('live-designer-viewport');
    const aiDock = screen.getByTestId('live-designer-ai-dock');
    expect(canvas.compareDocumentPosition(aiDock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('live-designer-ai-panel')).toBeInTheDocument();
  });

  it('keeps each vertical rail attached to its own panel', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LiveDesignerWorkspace componentPath="probe" draftId="draft-1" onBack={vi.fn()} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Show Outline' }));
    const outlineDock = screen.getByTestId('live-designer-outline-dock');
    const outlineRail = screen.getByRole('button', { name: 'Hide Outline' });
    const outlinePanel = screen.getByTestId('live-designer-outline-panel');
    expect(outlineDock).toContainElement(outlineRail);
    expect(outlineDock).toContainElement(outlinePanel);
    expect(outlineRail.compareDocumentPosition(outlinePanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show Properties' }));
    const propertiesDock = screen.getByTestId('live-designer-properties-dock');
    const propertiesRail = screen.getByRole('button', { name: 'Hide Properties' });
    const propertiesPanel = screen.getByTestId('live-designer-properties-panel');
    expect(propertiesDock).toContainElement(propertiesRail);
    expect(propertiesDock).toContainElement(propertiesPanel);
    expect(propertiesPanel.compareDocumentPosition(propertiesRail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show Code' }));
    const codeDock = screen.getByTestId('live-designer-code-dock');
    const codeRail = screen.getByRole('button', { name: 'Hide Code' });
    const codePanel = screen.getByTestId('live-designer-code-panel');
    expect(codeDock).toContainElement(codeRail);
    expect(codeDock).toContainElement(codePanel);
    expect(codePanel.compareDocumentPosition(codeRail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
