// @vitest-environment jsdom

import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PwaSettingsSection } from '../PwaSettingsSection';

const renderSection = (page: unknown) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PwaSettingsSection page={page as never} />
    </QueryClientProvider>,
  );
};

describe('PwaSettingsSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with legacy partial pwa draft settings', () => {
    const page = {
      draftSettings: {
        pwa: {
          enabled: true,
          name: 'Legacy App',
          shortName: 'Legacy',
        },
      },
      setDraftSettings: () => undefined,
    };

    renderSection(page);

    expect(screen.getByText(/Enable Progressive Web App/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install prompt banner' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ready to install notice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update available banner' })).toBeTruthy();
  });

  it('shows install banner preview at the live position without modal chrome', () => {
    const page = {
      draftSettings: {
        pwa: {
          enabled: true,
          name: 'Legacy App',
          shortName: 'Legacy',
          installPromptTitle: 'Install Legacy App',
        },
      },
      setDraftSettings: () => undefined,
    };

    renderSection(page);

    fireEvent.click(screen.getByRole('button', { name: 'Install prompt banner' }));

    expect(screen.getByRole('dialog', { name: /Install Legacy App/i })).toBeTruthy();
    expect(screen.queryByText(/Install banner preview/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Close$/i })).toBeNull();
  });
});
