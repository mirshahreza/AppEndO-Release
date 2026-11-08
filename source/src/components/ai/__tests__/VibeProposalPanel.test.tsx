// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VibeProposalPanel } from '../VibeProposalPanel';
import type { ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';

const mixedChangeSets: ChangeSet[] = [
  {
    id: 'cs-layout',
    kind: 'component_layout_patch',
    title: 'Component layout: Users Grid',
    layoutId: 'layout-wf3',
    patch: {
      name: 'Users Grid',
      folder: 'general',
      baseLayoutId: 'layout-wf3',
      document: { nodes: { root: { type: 'container' } } },
      previousDocument: { nodes: {} },
      bindingDefinitions: {},
    },
  },
  {
    id: 'cs-fn',
    kind: 'function_source_patch',
    title: 'Server function: Ping',
    functionId: 'ping',
    patch: {
      name: 'Ping',
      folder: 'api',
      source: 'export async function handler() { return { ok: true }; }',
    },
  },
  {
    id: 'cs-file',
    kind: 'file_patch',
    title: 'File patch: src/example.ts',
    path: 'src/example.ts',
    beforeContent: 'const x = 1;\n',
    content: 'const x = 2;\n',
    diffZones: [{ startLine: 1, endLine: 1 }],
  },
];

describe('VibeProposalPanel — per-file artifact cards (UX-7 / F.3)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a card per changeSet with diff stats badges', () => {
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-1', changeSets: mixedChangeSets }}
        validation={{ ok: true, violations: [] }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByRole('list', { name: /proposed file changes/i })).toBeInTheDocument();
    const fileCard = screen.getByTestId('change-set-card-cs-file');
    expect(fileCard).toBeInTheDocument();
    expect(fileCard).toHaveTextContent('+1');
    expect(fileCard).toHaveTextContent('−1');
    expect(fileCard).toHaveTextContent('src/example.ts');
  });

  it('expands a card to show colored diff lines', () => {
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-1', changeSets: [mixedChangeSets[2]!] }}
        validation={{ ok: true, violations: [] }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
    expect(screen.getByText(/const x = 2/)).toBeInTheDocument();
  });

  it('shows checkpoint banner and diff zone labels for file patches', () => {
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-1', changeSets: [mixedChangeSets[2]!] }}
        validation={{ ok: true, violations: [] }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText(/Checkpoint saved/i)).toBeInTheDocument();
    expect(screen.getByText(/L1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revert \/ Reject/i })).toBeInTheDocument();
  });

  it('switches expanded card when multiple artifacts are present', () => {
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-1', changeSets: mixedChangeSets }}
        validation={{ ok: true, violations: [] }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText(/root \(container\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Server function: Ping/i }));
    expect(screen.getByText(/export async function handler/)).toBeInTheDocument();
  });

  it('shows per-zone revert button when handler provided', () => {
    const onRevertZone = vi.fn();
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-1', changeSets: [mixedChangeSets[2]!] }}
        validation={{ ok: true, violations: [] }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onRevertZone={onRevertZone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Revert$/i }));
    expect(onRevertZone).toHaveBeenCalledWith('cs-file', { startLine: 1, endLine: 1 });
  });

  it('blocks confirm when validation has errors', () => {
    render(
      <VibeProposalPanel
        proposal={{ proposalId: 'prop-2', changeSets: [mixedChangeSets[0]!] }}
        validation={{
          ok: false,
          violations: [{ id: 'v1', severity: 'error', message: 'Blocked', ruleId: 'test' }],
        }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /create layout/i })).toBeDisabled();
  });
});
