// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import { createDefaultBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { DesignerPublishedShell } from '../DesignerPublishedShell';
import { DesignerPreviewPortalShell } from '../../../features/component-designer/components/DesignerPreviewPortalShell';
import { loadDesignerShellDraft } from '../../../shared/api/queries/component-designer';

vi.mock('../../../shared/api/queries/component-designer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/queries/component-designer')>();
  return { ...actual, loadDesignerShellDraft: vi.fn() };
});

vi.mock('../../../shared/api/queries/pwa', () => ({
  usePwaConfigQuery: () => ({ data: undefined }),
}));

vi.mock('../DesignerPublishedShellChrome', () => ({
  DesignerPublishedShellChromeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDesignerPublishedShellDirection: () => 'ltr',
  useDesignerPublishedShellSidebarCollapsed: () => false,
  useDesignerPublishedShellMobileMenuOpen: () => false,
  useDesignerPublishedShellMobileMenuState: () => [false, vi.fn()],
  ShellLogoSlot: () => <span data-runtime-slot="logo" />,
  ShellPortalMenuSlot: () => <span data-runtime-slot="portal-menu" />,
  ShellHeaderChromeSlot: () => <span data-runtime-slot="header" />,
  ShellSidebarToggleSlot: () => <span data-runtime-slot="sidebar-toggle" />,
}));

const compiledDocument: DesignerDocument = {
  schemaVersion: '1.0.0',
  id: 'compiled-parity-shell',
  name: 'Compiled parity shell',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['frame'],
    },
    frame: {
      id: 'frame',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: { colorScheme: 'light' },
      layout: {},
      binding: {},
      componentRef: { refType: 'system', refId: 'ShellFrame' },
      children: ['content'],
    },
    content: {
      id: 'content',
      type: 'container',
      parentId: 'frame',
      order: 0,
      props: { contentWidth: 'full' },
      layout: {},
      binding: {},
      componentRef: { refType: 'system', refId: 'ShellContentHost' },
      children: ['outlet'],
    },
    outlet: {
      id: 'outlet',
      type: 'system-slot',
      parentId: 'content',
      order: 0,
      props: { slotId: 'core.shell.route-outlet' },
      layout: {},
      binding: {},
      children: [],
    },
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  diagnostics: [],
};

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wiring(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(
    '[data-shell-frame],[data-shell-content-host],[data-platform-slot]',
  )).map((element) => (
    element.hasAttribute('data-shell-frame')
      ? 'ShellFrame'
      : element.hasAttribute('data-shell-content-host')
        ? 'ShellContentHost'
        : `slot:${element.getAttribute('data-platform-slot')}`
  ));
}

describe('compiled shell preview/published parity', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses identical component and slot wiring for the same document', async () => {
    vi.mocked(loadDesignerShellDraft).mockResolvedValue({
      id: 'creative-shell',
      name: 'Creative shell',
      folder: 'portal-layouts',
      document: compiledDocument,
      bindingDefinitions: createDefaultBindingDefinitions(),
    });

    const published = render(
      <QueryClientProvider client={queryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<DesignerPublishedShell shellKey="creative-shell" publishedVersion={7} />}>
              <Route index element={<div data-testid="published-route">Route</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('published-route');
    expect(loadDesignerShellDraft).toHaveBeenCalledWith('creative-shell', 7);
    const publishedWiring = wiring(published.container);
    published.unmount();

    const preview = render(
      <QueryClientProvider client={queryClient()}>
        <MemoryRouter>
          <DesignerPreviewPortalShell
            shellKey="creative-shell"
            routeOutlet={<div data-testid="preview-route">Route</div>}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('preview-route');

    expect(wiring(preview.container)).toEqual(publishedWiring);
    expect(publishedWiring).toEqual([
      'ShellFrame',
      'ShellContentHost',
      'slot:core.shell.route-outlet',
    ]);
  });
});
