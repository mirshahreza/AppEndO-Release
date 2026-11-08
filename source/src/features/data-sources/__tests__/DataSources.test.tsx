// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { ShellHeaderOverrideProvider } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { DataSourcesWorkspace } from '..';
import { DataSourceType } from '../../../shared/api/contracts/data-sources/types';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

const mockItems = [
  {
    id: 'ds-1',
    name: 'Production Warehouse',
    type: DataSourceType.POSTGRES,
    host: 'localhost',
    port: 5433,
    database: 'AppEnd',
    status: 'connected' as const,
    isDefault: true,
    created_at: '2024-01-15T10:00:00.000Z',
    created_by: 'admin',
    updated_at: '',
  },
  {
    id: 'ds-2',
    name: 'Customer Service Legacy',
    type: DataSourceType.MYSQL,
    host: 'db.example.com',
    port: 3306,
    database: 'legacy',
    status: 'disconnected' as const,
    created_at: '2024-03-10T10:00:00.000Z',
    updated_at: '2024-03-11T10:00:00.000Z',
  },
];

const metricsFor = (dataSourceId: string, openQuestionCount: number) => (
  dataSourceId === 'ds-1'
    ? {
        dataSourceId,
        tablesTotal: 10,
        tablesEnriched: 10,
        coverage: 1,
        overallConfidence: 0.3,
        openQuestionCount,
        columnsResolved: 4,
        columnsAmbiguous: 2,
        humanShare: 0.1,
        enrichedAt: '2024-06-15T10:00:00.000Z',
        lastRun: null,
      }
    : {
        dataSourceId,
        tablesTotal: 0,
        tablesEnriched: 0,
        coverage: 0,
        overallConfidence: null,
        openQuestionCount: 0,
        columnsResolved: 0,
        columnsAmbiguous: 0,
        humanShare: 0,
        enrichedAt: null,
        lastRun: null,
      }
);

const renderDataSources = (initialPath = '/studio/data-sources') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <CultureProvider cultureId="us" translationBundleSource="embedded">
          <ShellHeaderOverrideProvider>
            <PlatformMountProvider mount={testMount}>
              <DataSourcesWorkspace />
            </PlatformMountProvider>
          </ShellHeaderOverrideProvider>
        </CultureProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    Tooltip: {
      Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Content: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

vi.mock('../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  // Spread real exports first — AiAssistInput/AiAssistTextarea/AiCustomPromptDialog pull
  // UiInputCore/UiTextareaCore/etc. directly from this module, so hand-listing only the
  // controls below (as this mock used to do) breaks the moment those internals change.
  const actual = await importOriginal<typeof import('../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, placeholder, ariaLabel, type }: {
      value?: string | number;
      onChange?: React.ChangeEventHandler<HTMLInputElement>;
      placeholder?: string;
      ariaLabel?: string;
      type?: string;
    }) => (
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children }: {
      value?: string;
      onChange?: React.ChangeEventHandler<HTMLSelectElement>;
      ariaLabel?: string;
      children?: React.ReactNode;
    }) => (
      <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>
        {children}
      </select>
    ),
    UiCheckbox: ({ checked, onChange }: {
      checked?: boolean;
      onChange?: (event: { target: { checked: boolean } }) => void;
    }) => (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event: any) => onChange?.({ target: { checked: event.target.checked } })}
      />
    ),
  };
});

const resolveFetchPath = (input: RequestInfo | URL): string => {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.pathname + input.search
      : input.url;
  try {
    return new URL(raw, 'http://localhost').pathname + new URL(raw, 'http://localhost').search;
  } catch {
    return raw;
  }
};

const CHAT_CAPABILITIES = {
  chat: true,
  streaming: true,
  vision: false,
  tools: false,
  embeddings: false,
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
};

describe('DataSources Page', () => {
  let postedEnrichmentBody: unknown;

  beforeEach(() => {
    cleanup();
    postedEnrichmentBody = undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = resolveFetchPath(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (path === '/api/data-sources' || path.startsWith('/api/data-sources?')) {
        return new Response(JSON.stringify({ success: true, items: mockItems }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/ai/settings') {
        return new Response(JSON.stringify({ success: true, ai: { enabled: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/ai/models/available') {
        return new Response(JSON.stringify({
          success: true,
          enabled: true,
          defaultModelId: 'gpt-test',
          models: [
            {
              id: 'gpt-test',
              name: 'GPT Test',
              provider: 'openai',
              providerLabel: 'OpenAI',
              modelId: 'gpt-4.1',
              isDefault: true,
              hasApiKey: true,
              capabilities: CHAT_CAPABILITIES,
            },
            {
              id: 'gpt-strong',
              name: 'GPT Strong',
              provider: 'openai',
              providerLabel: 'OpenAI',
              modelId: 'gpt-4.1',
              isDefault: false,
              hasApiKey: true,
              capabilities: CHAT_CAPABILITIES,
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.startsWith('/api/db-enrichment/metrics')) {
        const dataSourceId = new URL(path, 'http://localhost').searchParams.get('dataSourceId') ?? 'ds-1';
        return new Response(JSON.stringify({
          success: true,
          metrics: metricsFor(dataSourceId, dataSourceId === 'ds-1' ? 366 : 0),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.startsWith('/api/db-enrichment/runs') && method === 'POST') {
        postedEnrichmentBody = init?.body ? JSON.parse(String(init.body)) : null;
        return new Response(JSON.stringify({ success: true, runId: 1, jobId: 9 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.startsWith('/api/db-enrichment/runs')) {
        const dataSourceId = new URL(path, 'http://localhost').searchParams.get('dataSourceId') ?? 'ds-1';
        const items = dataSourceId === 'ds-1'
          ? [{
              id: 1,
              dataSourceId,
              scope: 'FULL',
              status: 'completed',
              jobId: 9,
              modelId: 'gpt-test',
              tablesTotal: 10,
              tablesProcessed: 10,
              columnsResolved: 4,
              columnsAmbiguous: 2,
              questionsCreated: 366,
              overallConfidence: 0.3,
              progressLog: [],
              errorMessage: null,
              startedAt: '2024-06-15T09:00:00.000Z',
              finishedAt: '2024-06-15T10:00:00.000Z',
              createdAt: '2024-06-15T09:00:00.000Z',
            }]
          : [];
        return new Response(JSON.stringify({ success: true, items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.startsWith('/api/db-enrichment/questions')) {
        const dataSourceId = new URL(path, 'http://localhost').searchParams.get('dataSourceId') ?? 'ds-1';
        const items = dataSourceId === 'ds-1'
          ? Array.from({ length: 366 }, (_, index) => ({
              id: index + 1,
              dataSourceId,
              runId: 1,
              objectType: 'TABLE',
              objectName: 'users',
              columnName: null,
              kind: 'table_purpose',
              question: 'What is this table for?',
              reason: [],
              candidates: [],
              status: 'open',
              answer: null,
              answeredBy: null,
              answeredAt: null,
              createdAt: '2024-06-15T10:00:00.000Z',
            }))
          : [];
        return new Response(JSON.stringify({ success: true, items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders toolbar actions and data source rows from the API', async () => {
    renderDataSources();

    expect(screen.getByText('Test All')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Production Warehouse')).toBeInTheDocument();
      expect(screen.getByText('Customer Service Legacy')).toBeInTheDocument();
    });

    expect(screen.getByText('2 data sources')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText((_, node) => node?.textContent === 'Enriched at : 2024/06/15').length).toBeGreaterThan(0);
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: 'How to raise confidence' }).some((node) => node.textContent === '30% conf.'),
      ).toBe(true);
      expect(screen.getByRole('link', { name: 'Open 366 questions' })).toBeInTheDocument();
    });
  });

  it('opens delete confirmation modal instead of window.confirm', async () => {
    renderDataSources();

    await screen.findByText('Customer Service Legacy');

    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('Delete Data Source')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('opens questions as a page instead of a modal when the card link is clicked', async () => {
    renderDataSources();

    const questionsLink = await screen.findByRole('link', { name: 'Open 366 questions' });
    expect(questionsLink).toHaveAttribute('href', '/studio/data-sources/questions/ds-1');

    fireEvent.click(questionsLink);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back to Data Sources' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Search questions')).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[data-table-grid-chrome="classic"]')).toBeInTheDocument();
    expect(document.querySelector('[data-table-grid-chrome="hero"]')).not.toBeInTheDocument();
  });

  it('opens a maximized confidence guide from the card footer', async () => {
    renderDataSources();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'How to raise confidence' }).some((node) => node.textContent?.includes('30% conf.')),
      ).toBe(true);
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'How to raise confidence' }).find((node) => node.textContent?.includes('30% conf.'))!,
    );

    expect(await screen.findByRole('dialog', { name: 'How to raise confidence for Production Warehouse' })).toBeInTheDocument();
    expect(screen.getByText('Answer open questions')).toBeInTheDocument();
    expect(screen.getByText('Keep foreign keys intact')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open questions' })).toBeInTheDocument();
  });

  it('lets the operator pick an enrichment model before starting a run', async () => {
    renderDataSources();

    await screen.findByText('Production Warehouse');
    fireEvent.click(screen.getAllByRole('button', { name: 'Enrich with AI' })[0]);

    const modelSelect = await screen.findByLabelText('Enrichment model');
    await waitFor(() => {
      expect(modelSelect).toHaveValue('gpt-test');
      expect(screen.getByText('Coverage').closest('div')).toHaveTextContent('100%');
      expect(screen.getByText('Confidence').closest('div')).toHaveTextContent('30%');
      expect(screen.getByRole('button', { name: 'Open questions' })).toHaveTextContent('366');
    });

    fireEvent.change(modelSelect, { target: { value: 'gpt-strong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Enrichment' }));

    await waitFor(() => {
      expect(postedEnrichmentBody).toEqual({
        dataSourceId: 'ds-1',
        scope: 'FULL',
        modelId: 'gpt-strong',
      });
    });
  });
});
