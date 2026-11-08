// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import React, { useState } from 'react';
import { useWorkspaceOverlayDeepLink } from '../useWorkspaceOverlayDeepLink';
import { WORKSPACE_OVERLAY_QUERY_PARAM } from '../workspaceOverlayDeepLink';

function OverlayHarness(props: {
  activeToken: string | null;
  openFromUrl: (token: string) => void;
}) {
  useWorkspaceOverlayDeepLink({
    enabled: true,
    activeToken: props.activeToken,
    openFromUrl: props.openFromUrl,
  });
  const [params] = useSearchParams();
  return <span data-testid="overlay">{params.get(WORKSPACE_OVERLAY_QUERY_PARAM) ?? ''}</span>;
}

function ToggleOverlayPage() {
  const [token, setToken] = useState<string | null>(null);
  const openFromUrl = vi.fn();
  return (
    <div>
      <button type="button" onClick={() => setToken('dialog/create')}>open</button>
      <button type="button" onClick={() => setToken(null)}>close</button>
      <OverlayHarness activeToken={token} openFromUrl={openFromUrl} />
    </div>
  );
}

describe('useWorkspaceOverlayDeepLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens from URL once and does not re-open when openFromUrl identity changes', async () => {
    const openFromUrl = vi.fn();
    const openFromUrlV2 = vi.fn();
    let handler = openFromUrl;

    const { rerender } = render(
      <MemoryRouter initialEntries={['/page?overlay=panel%2Fdesigner']}>
        <Routes>
          <Route
            path="/page"
            element={<OverlayHarness activeToken={null} openFromUrl={handler} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(openFromUrl).toHaveBeenCalledTimes(1);
      expect(openFromUrl).toHaveBeenCalledWith('panel/designer');
    });

    handler = openFromUrlV2;
    rerender(
      <MemoryRouter initialEntries={['/page?overlay=panel%2Fdesigner']}>
        <Routes>
          <Route
            path="/page"
            element={<OverlayHarness activeToken={null} openFromUrl={handler} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(openFromUrlV2).not.toHaveBeenCalled();
  });

  it('writes overlay when UI opens and clears when activeToken is null', async () => {
    render(
      <MemoryRouter initialEntries={['/page']}>
        <Routes>
          <Route path="/page" element={<ToggleOverlayPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('overlay').textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    await waitFor(() => {
      expect(screen.getByTestId('overlay').textContent).toBe('dialog/create');
    });

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    await waitFor(() => {
      expect(screen.getByTestId('overlay').textContent).toBe('');
    });
  });
});
