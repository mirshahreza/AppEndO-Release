// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { createInitialDesignerState } from '../../../domain/component-designer/state';

vi.mock('../../../shared/lib/aiAgentStream', () => ({
  streamAiAgentRun: vi.fn(),
}));

import { streamAiAgentRun } from '../../../shared/lib/aiAgentStream';
import { ClientComponentAiPanel } from '../components/live-designer/ClientComponentAiPanel';

const streamAiAgentRunMock = vi.mocked(streamAiAgentRun);
const sampleDocument = createInitialDesignerState('probe').document;

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

describe('ClientComponentAiPanel Ask/Agent', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    streamAiAgentRunMock.mockReset();
  });

  it('hosts Ask/Agent (not Agentic) and lists only those two modes', () => {
    localStorage.setItem('appendo.chat-agency.v1:client-components', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ClientComponentAiPanel
            readSnapshot={() => '{}'}
            readOnly={false}
            layoutId="draft-1"
            componentName="probe"
            onApplyLayout={vi.fn()}
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

  it('writes drafted Agent layout onto the canvas', async () => {
    const onApplyLayout = vi.fn();
    const drafted = { ...sampleDocument, name: 'drafted-probe' };
    streamAiAgentRunMock.mockImplementation(async (_payload, handlers) => {
      handlers.onEvent({
        type: 'proposal',
        proposalId: 'p1',
        changeSets: [{
          id: 'cs1',
          kind: 'component_layout_patch',
          title: 'Component layout: probe',
          layoutId: 'probe',
          patch: { document: drafted, bindingDefinitions: {} },
        }],
      });
      return { text: 'I updated the layout.', modelId: 'demo', iterationCount: 1 };
    });

    localStorage.setItem('appendo.chat-agency.v1:client-components', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ClientComponentAiPanel
            readSnapshot={() => '{}'}
            readOnly={false}
            layoutId="draft-1"
            componentName="probe"
            onApplyLayout={onApplyLayout}
          />
        </CultureProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Client Component AI prompt'), {
      target: { value: 'Add a heading' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    await waitFor(() => {
      expect(onApplyLayout).toHaveBeenCalledWith({
        document: drafted,
        bindingDefinitions: {},
      });
    });
  });

  it('tells the operator when Agent claimed a fix but drafted no layout', async () => {
    streamAiAgentRunMock.mockResolvedValue({
      text: 'I modified the layout so the heading is larger.',
      modelId: 'demo',
      iterationCount: 1,
    });

    localStorage.setItem('appendo.chat-agency.v1:client-components', 'agentic');
    render(
      <MemoryRouter>
        <CultureProvider cultureId="us">
          <ClientComponentAiPanel
            readSnapshot={() => '{}'}
            readOnly={false}
            layoutId="draft-1"
            componentName="probe"
            onApplyLayout={vi.fn()}
          />
        </CultureProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Client Component AI prompt'), {
      target: { value: 'Make the heading larger' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    expect(await screen.findByText(/No layout was written onto the canvas/)).toBeInTheDocument();
  });
});
