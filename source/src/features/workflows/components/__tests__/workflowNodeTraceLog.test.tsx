// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowNodeTraceLog } from '../WorkflowNodeTraceLog';
import type { WorkflowProofEntry } from '../../types';

afterEach(cleanup);

const entry = (overrides: Partial<WorkflowProofEntry>): WorkflowProofEntry => ({
  sequenceNumber: 1,
  traceType: 'NODE_READY',
  nodeInstanceId: 501,
  corePayloadJson: '{}',
  diagnosticPayloadJson: null,
  createdAt: '2026-08-29T00:00:00.000Z',
  ...overrides,
});

describe('WorkflowNodeTraceLog (p-99/WFT-11)', () => {
  it('shows a placeholder when there is no recorded evidence', () => {
    render(<WorkflowNodeTraceLog entries={[]} />);
    expect(screen.getByText(/No trace evidence recorded/)).toBeInTheDocument();
  });

  it('renders entries in sequence order with a one-line summary derived from the core payload', () => {
    const entries = [
      entry({ sequenceNumber: 2, traceType: 'EDGE_SELECTED', corePayloadJson: JSON.stringify({ selectionMode: 'UNCONDITIONAL', selectedEdgeKey: 'e1', selectionReason: 'single unconditional outgoing edge' }) }),
      entry({ sequenceNumber: 1, traceType: 'ACTION_ATTEMPT_SUCCEEDED', corePayloadJson: JSON.stringify({ attemptNumber: 1, providerIdentity: 'core@1' }) }),
    ];
    render(<WorkflowNodeTraceLog entries={entries} />);

    const rows = screen.getAllByRole('button');
    // Sorted by sequenceNumber ascending regardless of input order.
    expect(rows[0]).toHaveTextContent('ACTION_ATTEMPT_SUCCEEDED');
    expect(rows[0]).toHaveTextContent('attempt #1 — core@1');
    expect(rows[1]).toHaveTextContent('EDGE_SELECTED');
    expect(rows[1]).toHaveTextContent('UNCONDITIONAL → e1');
  });

  it('expands to show the raw core/diagnostic JSON on click, and collapses again', () => {
    const entries = [
      entry({
        traceType: 'SUBFLOW_COMPLETED',
        corePayloadJson: JSON.stringify({ nodeKey: 'sub1', waitId: '42' }),
        diagnosticPayloadJson: JSON.stringify({ childInstanceStatus: 'CANCELLED_BY_REGION_EVENT' }),
      }),
    ];
    render(<WorkflowNodeTraceLog entries={entries} />);

    expect(screen.queryByText(/"childInstanceStatus"/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/"childInstanceStatus": "CANCELLED_BY_REGION_EVENT"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/"childInstanceStatus"/)).not.toBeInTheDocument();
  });

  it('a row with an unparseable/empty payload is not expandable', () => {
    const entries = [entry({ traceType: 'NODE_CLAIMED', corePayloadJson: '', diagnosticPayloadJson: null })];
    render(<WorkflowNodeTraceLog entries={entries} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('a row with a real (even empty-object) payload is expandable', () => {
    const entries = [entry({ traceType: 'NODE_CLAIMED', corePayloadJson: '{}', diagnosticPayloadJson: null })];
    render(<WorkflowNodeTraceLog entries={entries} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('falls back to the raw type name with no summary line for an unrecognized trace type', () => {
    const entries = [entry({ traceType: 'SOME_FUTURE_TYPE', corePayloadJson: '{}' })];
    render(<WorkflowNodeTraceLog entries={entries} />);
    expect(screen.getByText('SOME_FUTURE_TYPE')).toBeInTheDocument();
  });
});
