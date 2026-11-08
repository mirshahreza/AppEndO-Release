/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PageGuideHost } from '../PageGuideHost';

vi.mock('../../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../../../lib/useViewportTier', () => ({
  useViewportTier: () => 'desktop',
}));

vi.mock('../../../../../app/platform/publicAppPaths', () => ({
  isPublicAppPath: () => false,
}));

const pageGuideActive = vi.hoisted(() => ({ value: true }));

vi.mock('../pageGuideStore', () => ({
  usePageGuideActive: () => pageGuideActive.value,
  stopPageGuide: vi.fn(),
}));

vi.mock('../PageGuideOverlay', () => ({
  PageGuideOverlay: ({ copy }: { copy: { chooser: { title: string } } }) => (
    <div data-testid="page-guide-overlay">{copy.chooser.title}</div>
  ),
}));

afterEach(() => {
  pageGuideActive.value = true;
  cleanup();
});

describe('PageGuideHost', () => {
  it('loads iq culture strings for portal paths', async () => {
    render(
      <MemoryRouter initialEntries={['/iq/portal/example']}>
        <PageGuideHost />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-guide-overlay').textContent).toBe('ماذا أشرح؟');
    });
  });
});
