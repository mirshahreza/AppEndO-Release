// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlatformTransferPage } from '../PlatformTransferPage';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';

const studioMount: PlatformMount = {
  id: 'studio',
  name: 'Studio',
  pathPrefix: '/studio',
  enabled: true,
  designerRoutePropagation: 'manual',
};

describe('PlatformTransferPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects the legacy URL into Settings', async () => {
    render(
      <PlatformMountProvider mount={studioMount}>
        <MemoryRouter initialEntries={['/studio/platform-transfer']}>
          <Routes>
            <Route path="/studio/platform-transfer" element={<PlatformTransferPage />} />
            <Route path="/studio/settings/*" element={<div>settings-platform-transfer</div>} />
          </Routes>
        </MemoryRouter>
      </PlatformMountProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('settings-platform-transfer')).toBeInTheDocument();
    });
  });
});
