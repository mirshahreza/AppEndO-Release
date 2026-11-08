// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

afterEach(cleanup);

const summaryMock = vi.fn();

vi.mock('../../../../shared/api/personalInboxApi', () => ({
  PERSONAL_INBOX_CHANGED_EVENT: 'appendo:personal-inbox-changed',
  personalInboxApi: {
    summary: (...args: unknown[]) => summaryMock(...args),
  },
}));

vi.mock('../../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useCulture: () => ({ direction: 'ltr', ready: true, t: (key: string) => key }),
}));

vi.mock('../../../../app/platform/PlatformConfigProvider', () => ({
  usePlatformConfig: () => ({
    config: {
      version: 'v1',
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
      navigations: [],
    },
  }),
}));

vi.mock('../../../../app/platform/PlatformMountContext', () => ({
  useOptionalPlatformMount: () => ({ id: 'studio' }),
}));

import { ShellNotificationBell } from '../ShellNotificationBell';

describe('ShellNotificationBell', () => {
  it('shows attention badge from inbox summary', async () => {
    summaryMock.mockResolvedValue({
      attentionCount: 2,
      breakdown: { workItems: 1, feedback: 1, alerts: 0 },
      preview: [],
    });

    render(
      <MemoryRouter initialEntries={['/iq/studio/dashboard']}>
        <Routes>
          <Route path="/iq/studio/dashboard" element={<ShellNotificationBell />} />
          <Route path="/iq/studio/my-inbox" element={<div data-testid="inbox-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(summaryMock).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: 'Inbox (2)' })).toBeTruthy();
    expect(screen.getByTestId('shell-inbox-attention-badge').textContent).toBe('2');
  });

  it('navigates to inbox when the bell is clicked', async () => {
    summaryMock.mockResolvedValue({
      attentionCount: 0,
      breakdown: { workItems: 0, feedback: 0, alerts: 0 },
      preview: [],
    });

    render(
      <MemoryRouter initialEntries={['/iq/studio/dashboard']}>
        <Routes>
          <Route path="/iq/studio/dashboard" element={<ShellNotificationBell />} />
          <Route path="/iq/studio/my-inbox" element={<div data-testid="inbox-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Inbox' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
    await waitFor(() => {
      expect(screen.getByTestId('inbox-page')).toBeTruthy();
    });
  });

  it('on my-inbox does not navigate when clicked', async () => {
    summaryMock.mockResolvedValue({
      attentionCount: 3,
      breakdown: { workItems: 3, feedback: 0, alerts: 0 },
      preview: [],
    });

    render(
      <MemoryRouter initialEntries={['/iq/studio/my-inbox']}>
        <Routes>
          <Route path="/iq/studio/my-inbox" element={<ShellNotificationBell />} />
          <Route path="/iq/studio/dashboard" element={<div data-testid="dashboard-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('shell-inbox-attention-badge').textContent).toBe('3');
    });

    const bell = screen.getByRole('button', { name: 'Inbox (3)' });
    expect(bell.hasAttribute('disabled')).toBe(true);
    fireEvent.click(bell);
    expect(screen.queryByTestId('dashboard-page')).toBeNull();
  });
});
