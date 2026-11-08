/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { FeedbackEntryButton } from '../components/FeedbackSubmitDialog';
import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from '../../../shared/api/contracts/feedback/constants';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 1, email: 'dev@local', role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

vi.mock('../../../shared/api/queries/boot', () => ({
  useAppBootQuery: () => ({
    data: {
      feedbackPolicy: {
        ...DEFAULT_PLATFORM_FEEDBACK_POLICY,
        enabled: true,
        widgetPlacement: 'header-menu',
      },
    },
    isLoading: false,
  }),
}));

describe('FeedbackEntryButton mount safety', () => {
  it('does not require PlatformMountProvider when dialog is closed', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() => render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CultureProvider cultureId="us">
            <FeedbackEntryButton variant="header" pageKey="dashboard" />
          </CultureProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )).not.toThrow();
  });
});
