// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createInitialDesignerState } from '../../../../../domain/component-designer/state';
import { updateComponentDesignerVersion } from '../../../../../shared/api/queries/component-designer';
import { LIVE_DESIGNER_SAVE_BUSY_HOLD_MS } from '../LiveDesignerBusyOverlay';
import { LiveDesignerWorkspace } from '../LiveDesignerWorkspace';

const sampleState = createInitialDesignerState('probe');
const builtinDocument = { ...sampleState.document, id: 'builtin-blank' };

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
    id: 'builtin-blank',
    name: 'probe',
    document: builtinDocument,
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
  vi.useRealTimers();
});

describe('LiveDesignerWorkspace save feedback', () => {
  it('shows Saved only after the center progress overlay finishes', async () => {
    vi.mocked(updateComponentDesignerVersion).mockResolvedValue({
      id: 'builtin-blank',
      name: 'probe',
      document: builtinDocument,
      bindingDefinitions: sampleState.bindingDefinitions,
    } as Awaited<ReturnType<typeof updateComponentDesignerVersion>>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LiveDesignerWorkspace componentPath="probe" draftId="builtin-blank" onBack={vi.fn()} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const save = await screen.findByRole('button', { name: 'Save draft' });
    expect(save).toBeEnabled();

    vi.useFakeTimers();
    fireEvent.click(save);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('live-designer-busy-overlay')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_DESIGNER_SAVE_BUSY_HOLD_MS - 1);
    });
    expect(screen.getByTestId('live-designer-busy-overlay')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByTestId('live-designer-busy-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });
});
