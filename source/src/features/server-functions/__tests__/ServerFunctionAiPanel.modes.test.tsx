// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CultureProvider } from '../../../app/platform/CultureContext';
vi.mock('../../../shared/lib/aiAgentStream', () => ({
  streamAiAgentRun: vi.fn(),
}));

import { streamAiAgentRun } from '../../../shared/lib/aiAgentStream';
import { ServerFunctionAiPanel } from '../components/ServerFunctionAiPanel';

const streamAiAgentRunMock = vi.mocked(streamAiAgentRun);

vi.mock('../../../shared/api/queries/aiModels', () => ({
  useAvailableAiModelsQuery: () => ({
    isLoading: false,
    data: {
      enabled: true,
      defaultModelId: 'demo',
      models: [{
        id: 'demo',
        name: 'Demo',
        provider: 'openai',
        providerLabel: 'OpenAI',
        modelId: 'gpt-4',
        isDefault: true,
        hasApiKey: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: true,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
      }],
    },
  }),
}));

vi.mock('../../../shared/api/queries/aiMcpAccess', () => ({
  useAiMcpAccessMeQuery: () => ({
    data: {
      success: true,
      packs: [],
      mcpServers: [],
      defaultScope: { packIds: [], mcpServerIds: [] },
    },
  }),
}));

describe('ServerFunctionAiPanel Ask/Agent', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    streamAiAgentRunMock.mockReset();
  });

  it('hosts Ask/Agent (not Agentic) and lists only those two modes', () => {
    localStorage.setItem('appendo.chat-agency.v1:server-functions', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ServerFunctionAiPanel
            readSnapshot={() => '{}'}
            language="typescript"
            readOnly={false}
            functionId="custom.probe"
            functionName="probe"
            onApplySource={vi.fn()}
          />
        </CultureProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('radio', { name: 'Agentic' })).not.toBeInTheDocument();
    expect(screen.queryByText('Agentic')).not.toBeInTheDocument();

    const mode = screen.getByRole('button', { name: 'Chat mode: Agent' });
    fireEvent.click(mode);
    const options = screen.getAllByRole('option').map((node) => node.textContent?.trim());
    expect(options).toEqual(['Ask', 'Agent']);
  });

  it('writes drafted Agent source into the editor', async () => {
    const onApplySource = vi.fn();
    const drafted = 'edgeRes.json({ ok: true, warning: "Missing SerpAPI key" });';
    streamAiAgentRunMock.mockImplementation(async (_payload, handlers) => {
      handlers.onEvent({
        type: 'proposal',
        proposalId: 'p1',
        changeSets: [{
          id: 'cs1',
          kind: 'function_source_patch',
          title: 'Function: probe',
          functionId: 'custom.probe',
          patch: { source: drafted },
        }],
      });
      return { text: 'I updated the handler.', modelId: 'demo', iterationCount: 1 };
    });

    localStorage.setItem('appendo.chat-agency.v1:server-functions', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ServerFunctionAiPanel
            readSnapshot={() => '{}'}
            language="typescript"
            readOnly={false}
            functionId="custom.probe"
            functionName="probe"
            onApplySource={onApplySource}
          />
        </CultureProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Server Function AI prompt'), {
      target: { value: 'This has an error' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    await waitFor(() => {
      expect(onApplySource).toHaveBeenCalledWith(drafted);
    });
  });

  it('tells the operator when Agent claimed a fix but drafted no source', async () => {
    streamAiAgentRunMock.mockResolvedValue({
      text: 'I modified the function so missing keys are warnings.',
      modelId: 'demo',
      iterationCount: 1,
    });

    localStorage.setItem('appendo.chat-agency.v1:server-functions', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ServerFunctionAiPanel
            readSnapshot={() => '{}'}
            language="typescript"
            readOnly={false}
            functionId="custom.probe"
            functionName="probe"
            onApplySource={vi.fn()}
          />
        </CultureProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Server Function AI prompt'), {
      target: { value: 'This has an error' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    expect(await screen.findByText(/No source was written into the editor/)).toBeInTheDocument();
  });
});
