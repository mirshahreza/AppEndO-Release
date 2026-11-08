// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
}));

vi.mock('../../platform/PlatformConfigProvider', () => ({
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

vi.mock('../../platform/PlatformMountContext', () => ({
  useOptionalPlatformMount: () => ({ id: 'studio' }),
}));

vi.mock('../../../features/work-items/hooks/usePersonalInboxShellHeader', () => ({
  usePersonalInboxShellHeader: vi.fn(),
}));

vi.mock('../../../features/work-items/components/PersonalInboxPage', () => ({
  PersonalInboxPage: ({ initialKind }: { initialKind?: string }) => (
    <div data-testid="inbox-list" data-kind={initialKind ?? 'all'} />
  ),
}));

vi.mock('../../../features/work-items/components/WorkItemInboxPanel', () => ({
  WorkItemInboxPanel: ({ initialWorkItemId }: { initialWorkItemId: number }) => (
    <div data-testid="work-item-detail" data-id={String(initialWorkItemId)} />
  ),
}));

import { MyInboxPage } from '../MyInboxPage';

describe('MyInboxPage routing', () => {
  it('renders list by default', () => {
    render(
      <MemoryRouter initialEntries={['/iq/studio/my-inbox']}>
        <Routes>
          <Route path="/iq/studio/my-inbox" element={<MyInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inbox-list')).toBeTruthy();
    expect(screen.getByTestId('inbox-list').getAttribute('data-kind')).toBe('all');
  });

  it('renders work item detail when workItemId is valid', () => {
    render(
      <MemoryRouter initialEntries={['/iq/studio/my-inbox?workItemId=15']}>
        <Routes>
          <Route path="/iq/studio/my-inbox" element={<MyInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('work-item-detail').getAttribute('data-id')).toBe('15');
  });

  it('passes kind filter from query string', () => {
    render(
      <MemoryRouter initialEntries={['/iq/studio/my-inbox?kind=feedback']}>
        <Routes>
          <Route path="/iq/studio/my-inbox" element={<MyInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inbox-list').getAttribute('data-kind')).toBe('feedback');
  });

  it('redirects legacy view=messages to send-log filter', () => {
    render(
      <MemoryRouter initialEntries={['/iq/studio/my-inbox?view=messages']}>
        <Routes>
          <Route path="/iq/studio/my-inbox" element={<MyInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inbox-list')).toBeTruthy();
    expect(screen.getByTestId('inbox-list').getAttribute('data-kind')).toBe('message_dispatch');
  });
});
