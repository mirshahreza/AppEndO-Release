// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

/** Mirrors exactly what `communicationEmailSendDefinition` (corePack) now sends over the wire —
 * this is the real shape the Designer receives, not a synthetic fixture. */
const emailSendCatalogEntry: ActionCatalogEntry = {
  key: 'communication.email-send',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'WRITE_EXTERNAL',
  tags: ['communication', 'email'],
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email', title: 'To' },
        subject: { type: 'string' },
        text: { type: 'string', title: 'Body (plain text)' },
        html: { type: 'string', title: 'Body (HTML, optional)' },
      },
      required: ['to', 'subject', 'text'],
    },
  },
};

/** An Action with no declared schema (undeclared/PLATFORM Action, or a `REF` this client can't
 * resolve) — must fall back to the original free-form key/value editor, unchanged. */
const undeclaredCatalogEntry: ActionCatalogEntry = {
  key: 'platform.custom-thing',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'PURE',
  tags: [],
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
};

const model: WorkflowModel = { schemaVersion: '1', key: 'wf', name: 'wf', start: { type: 'MANUAL_API', targetNodeKey: 'a1' }, nodes: [], edges: [] };

const actionNode = (actionKey: string): WorkflowNode => ({
  key: 'a1',
  kind: 'ACTION',
  actionRef: { action: { actionKey, actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
});

describe('NodeKindForm ACTION case — schema-driven fields', () => {
  it('renders one labeled, required-marked field per inputSchema property for a real corePack Action', () => {
    render(
      <NodeKindForm
        node={actionNode('communication.email-send')}
        model={model}
        definitionId={1}
        actionCatalog={[emailSendCatalogEntry]}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('To *')).toBeInTheDocument();
    expect(screen.getByText('Subject *')).toBeInTheDocument();
    expect(screen.getByText('Body (plain text) *')).toBeInTheDocument();
    expect(screen.getByText('Body (HTML, optional)')).toBeInTheDocument();

    // Input mapping is schema-driven now — only its scoped "extra field" adder remains, not the old
    // blind "type the field name yourself" box. (Config mapping still falls back to the generic
    // editor here since `communication.email-send`'s configSchema is legitimately empty — all its
    // fields live on inputSchema — proving the per-section fallback is independent, not all-or-nothing.)
    expect(screen.getByPlaceholderText('Add an extra field not listed above…')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('new field name…')).toHaveLength(1);
  });

  it('falls back to the free-form key/value editor when an Action has no declared schema', () => {
    render(
      <NodeKindForm
        node={actionNode('platform.custom-thing')}
        model={model}
        definitionId={1}
        actionCatalog={[undeclaredCatalogEntry]}
        onChange={() => {}}
      />,
    );

    expect(screen.getAllByPlaceholderText('new field name…').length).toBeGreaterThan(0);
  });
});

describe('NodeKindForm LOOP / DECISION toolbox cases', () => {
  it('renders the LOOP while-condition and max-iterations fields', () => {
    const loopNode: WorkflowNode = {
      key: 'l1',
      kind: 'LOOP',
      condition: { op: 'LITERAL', value: true },
      actionRef: { action: { actionKey: 'text.template', actionVersion: '1' } },
      input: { type: 'OBJECT', fields: {} },
      config: { type: 'OBJECT', fields: {} },
      maxIterations: 5,
    };
    render(
      <NodeKindForm
        node={loopNode}
        model={model}
        definitionId={1}
        actionCatalog={[undeclaredCatalogEntry]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/While condition/i)).toBeInTheDocument();
    expect(screen.getByText(/Max iterations/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Current Item Index/i).length).toBeGreaterThan(0);
  });

  it('lists MULTI_MATCH as an inclusive-gateway option on DECISION', () => {
    const decisionNode: WorkflowNode = { key: 'd1', kind: 'DECISION', mode: 'EXACT_ONE' };
    render(
      <NodeKindForm
        node={decisionNode}
        model={model}
        definitionId={1}
        actionCatalog={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Ambiguity mode/i)).toBeInTheDocument();
    expect(screen.getByText(/inclusive gateway/i)).toBeInTheDocument();
  });
});
