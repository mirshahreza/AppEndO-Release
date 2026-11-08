// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../shared/api/queries/file-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/queries/file-manager')>();
  return {
    ...actual,
    useFileManagerConfigQuery: () => ({
      isLoading: false,
      isError: false,
      data: {
        defaultScope: 'workspace',
        workspaceDir: 'workspace',
        workspaceExists: true,
        projectRootLabel: 'AppEndO',
      },
    }),
    fetchFileManagerEntries: vi.fn(async () => []),
  };
});

vi.mock('../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui')>();
  return {
    ...actual,
    useWorkspaceVerticalSplitPanel: () => ({
      size: 320,
      isResizing: false,
      splitHandleProps: {},
    }),
  };
});

describe('FileManagerWorkspace', () => {
  it('renders without crashing', async () => {
    const { FileManagerWorkspace } = await import('../FileManagerWorkspace');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FileManagerWorkspace />
      </QueryClientProvider>,
    );

    expect(await screen.findByPlaceholderText('files…')).toBeTruthy();
    expect(await screen.findByText('assets')).toBeTruthy();
  });
});
