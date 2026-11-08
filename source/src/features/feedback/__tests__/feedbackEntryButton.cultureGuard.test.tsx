/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackEntryButton } from '../components/FeedbackSubmitDialog';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    currentUser: { id: 1, email: 'dev@local', role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

describe('FeedbackEntryButton culture guard', () => {
  it('does not crash when rendered outside CultureProvider', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() => render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FeedbackEntryButton variant="fab" pageKey="dashboard" />
        </MemoryRouter>
      </QueryClientProvider>,
    )).not.toThrow();
  });
});
