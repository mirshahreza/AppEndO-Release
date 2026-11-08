/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import * as React from 'react';
import type { DesignerDocument } from '../../../../domain/component-designer/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ShellLayoutWidthProvider,
  useResolvedShellLayoutWidth,
  useShellLayoutWidth,
} from '../ShellLayoutWidthContext';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const withQueryClient = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
);

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const boundedDocument = (): DesignerDocument => ({
  schemaVersion: '1',
  id: 'shell-doc',
  name: 'Portal',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      parentId: undefined,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    },
  },
  metadata: {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    shellLayoutWidth: 'bounded',
    shellLayoutWidthUserControl: true,
  },
  diagnostics: [],
});

const Probe: React.FC = () => {
  const layout = useShellLayoutWidth();
  const resolved = useResolvedShellLayoutWidth(boundedDocument());
  return (
    <div>
      <span data-testid="active">{layout.activeWidth}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={layout.toggle}>toggle</button>
    </div>
  );
};

describe('ShellLayoutWidthProvider', () => {
  it('expands bounded layout to fluid for the session when toggled', () => {
    render(withQueryClient(
      <ShellLayoutWidthProvider document={boundedDocument()} shellKey="portal-a">
        <Probe />
      </ShellLayoutWidthProvider>,
    ));

    expect(screen.getByTestId('active')).toHaveTextContent('bounded');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('active')).toHaveTextContent('fluid');
    expect(sessionStorage.getItem('appendo:shell-page-width-expanded:portal-a')).toBe('true');
  });

  it('restores expanded state from sessionStorage', () => {
    sessionStorage.setItem('appendo:shell-page-width-expanded:portal-b', 'true');
    render(withQueryClient(
      <ShellLayoutWidthProvider document={boundedDocument()} shellKey="portal-b">
        <Probe />
      </ShellLayoutWidthProvider>,
    ));
    expect(screen.getByTestId('active')).toHaveTextContent('fluid');
  });
});
