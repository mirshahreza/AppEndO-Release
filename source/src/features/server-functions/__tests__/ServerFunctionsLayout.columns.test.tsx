// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ServerFunctionsPageState } from '../hooks/useServerFunctionsPage';
import { ServerFunctionsLayout } from '../components/ServerFunctionsLayout';

vi.mock('../../../shared/api/queries/aiModels', () => ({
  useAiSettingsQuery: () => ({ data: { enabled: true } }),
}));

vi.mock('../components/ServerFunctionEditorPanel', () => ({
  ServerFunctionEditorPanel: () => <div data-testid="server-functions-editor" />,
}));

vi.mock('../components/TestConsolePanel', () => ({
  TestConsolePanel: () => <div data-testid="server-functions-test-console" />,
}));

vi.mock('../components/ServerFunctionAiPanel', () => ({
  ServerFunctionAiPanel: () => <div data-testid="server-functions-ai-panel" />,
}));

vi.mock('../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui')>();
  return {
    ...actual,
    WorkspaceVerticalSplitHandle: () => <div data-testid="split-handle" />,
  };
});

describe('ServerFunctionsLayout column order', () => {
  it('docks the AI chat panel to the right of the Test Console', () => {
    const page = {
      editSlugFromUrl: 'custom/test',
      isNewDraftRoute: false,
      activeId: 'custom.test',
      activeFn: {
        name: 'test',
        method: 'GET',
        path: '/api/test',
        language: 'ts',
        engineType: 'SANDBOX_JS',
      },
      draftFn: { name: '', language: 'ts', engineType: 'SANDBOX_JS' },
      isActiveBuiltIn: false,
      currentCode: '',
      getTestPayloadDisplay: () => '{}',
      updateTestPayload: vi.fn(),
      applySourceToEditor: vi.fn(),
      aiOpen: true,
      isRunning: false,
      output: null,
      logs: [],
      containerRef: { current: null },
      isResizingSidebar: false,
      isResizingPayload: false,
      isResizingPayloadHeight: false,
      payloadSplitHandleProps: {},
    } as unknown as ServerFunctionsPageState;

    render(<ServerFunctionsLayout page={page} workspace={<div />} />);

    const editor = screen.getByTestId('server-functions-editor');
    const consolePanel = screen.getByTestId('server-functions-test-console');
    const aiDock = screen.getByTestId('server-functions-ai-dock');
    expect(editor.compareDocumentPosition(consolePanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(consolePanel.compareDocumentPosition(aiDock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aiDock).not.toHaveClass('contents');
    expect(aiDock).not.toHaveClass('hidden');
  });
});
