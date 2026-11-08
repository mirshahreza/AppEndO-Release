// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorStorePanel } from '../InspectorStorePanel';
import { createDefaultBindingDefinitions } from '../../../../domain/component-designer/bindingRegistry';
import type { DesignerDocument } from '../../../../domain/component-designer/types';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="monaco-editor" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

afterEach(() => {
  cleanup();
});

const document: DesignerDocument = {
  schemaVersion: '1.0.0',
  id: 'doc-1',
  name: 'Doc',
  rootNodeId: 'root',
  nodes: {},
  metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  diagnostics: [],
};

describe('InspectorStorePanel — Initial Value upgraded to Monaco JSON editor', () => {
  it('renders the segment initial value through the Monaco-backed editor', async () => {
    const bindingDefinitions = createDefaultBindingDefinitions();
    bindingDefinitions.storeSegments.selection = {
      id: 'selection',
      initialValue: { id: null },
      persist: 'none',
    };

    render(
      <InspectorStorePanel
        bindingDefinitions={bindingDefinitions}
        document={document}
        dispatch={() => {}}
      />,
    );

    const editor = await screen.findByLabelText('monaco-editor');
    expect(editor).toHaveValue(JSON.stringify({ id: null }, null, 2));
  });

  it('committing valid JSON dispatches a set-store-segment action with the parsed value', async () => {
    const bindingDefinitions = createDefaultBindingDefinitions();
    bindingDefinitions.storeSegments.selection = {
      id: 'selection',
      initialValue: {},
      persist: 'none',
    };
    const dispatched: unknown[] = [];

    render(
      <InspectorStorePanel
        bindingDefinitions={bindingDefinitions}
        document={document}
        dispatch={(action) => dispatched.push(action)}
      />,
    );

    const editor = await screen.findByLabelText('monaco-editor');
    fireEvent.change(editor, { target: { value: '{"count":1}' } });

    const lastAction = dispatched.at(-1) as { type: string; segmentId: string; segment: { initialValue: unknown } };
    expect(lastAction.type).toBe('set-store-segment');
    expect(lastAction.segmentId).toBe('selection');
    expect(lastAction.segment.initialValue).toEqual({ count: 1 });
  });
});
