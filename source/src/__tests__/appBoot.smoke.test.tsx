// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutAppModal } from '../components/AboutAppModal';
import { PwaManager } from '../components/PwaManager';
import { CultureProvider } from '../core/culture/CultureContext';
import { bootstrapCultureRegistry } from '../core/culture/CultureRegistry';

vi.mock('../shared/api/queries/pwa', async () => {
  const actual = await vi.importActual<typeof import('../shared/api/queries/pwa')>('../shared/api/queries/pwa');
  return {
    ...actual,
    usePwaConfigQuery: () => ({
      data: {
        enabled: false,
        name: 'AppEndO',
        shortName: 'AppEndO',
        description: 'Test',
        themeColor: '#00A28A',
        backgroundColor: '#FFFFFF',
        faviconUrl: '',
        icon192Url: '',
        icon512Url: '',
        maskableIcon512Url: '',
        iconSourceRef: '',
        display: 'standalone',
        orientation: 'any',
        startUrl: '/',
        scope: '/',
        showInstallPrompt: false,
        installPromptTitle: '',
        installPromptMessage: '',
        installButtonLabel: '',
        dismissButtonLabel: '',
        installReadyMessage: '',
        updateAvailableMessage: '',
        updateButtonLabel: '',
      },
      isLoading: false,
      isError: false,
    }),
  };
});

describe('app boot smoke', () => {
  it('renders AboutAppModal without crashing', () => {
    bootstrapCultureRegistry();
    render(
      <CultureProvider cultureId="us">
        <AboutAppModal open onClose={() => undefined} />
      </CultureProvider>,
    );
    expect(document.body.textContent).toContain('AI-Assisted Framework for Rapid Application Development');
  });

  it('renders PwaManager without crashing', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <PwaManager />
      </QueryClientProvider>,
    );
    expect(document.body).toBeTruthy();
  });
});
