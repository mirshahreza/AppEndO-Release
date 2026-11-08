// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorDynamicActionsField } from '../InspectorDynamicActionsField';
import { createDynamicAction } from '../../../../domain/component-designer/bindingDynamicActionsEngine';
import { createDefaultBindingDefinitions } from '../../../../domain/component-designer/bindingRegistry';
import type { DesignerDocument, DesignerDynamicAction } from '../../../../domain/component-designer/types';

afterEach(() => {
  cleanup();
});

const document: DesignerDocument = {
  schemaVersion: '1.0.0',
  id: 'doc-1',
  name: 'Doc',
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
      children: [],
    },
  },
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  diagnostics: [],
};

describe('InspectorDynamicActionsField — Payload mapping wired onto InspectorKeyValueListField', () => {
  it('renders the triggerWorkflow payload mapping as key/value rows instead of a single-line JSON input', () => {
    const action: DesignerDynamicAction = {
      ...createDynamicAction('triggerWorkflow'),
      workflowDefinitionId: '42',
      payloadMapping: { orderId: 'selection.id' },
    };

    render(
      <InspectorDynamicActionsField
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        trueActions={[action]}
        onChange={() => {}}
      />,
    );

    // No raw JSON text anywhere for the mapping field.
    expect(screen.queryByDisplayValue('{"orderId":"selection.id"}')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('orderId')).toBeInTheDocument();
    expect(screen.getByDisplayValue('selection.id')).toBeInTheDocument();
  });

  it('editing a mapping row produces the same payloadMapping shape the old inline JSON input would have produced', () => {
    const action: DesignerDynamicAction = {
      ...createDynamicAction('triggerWorkflow'),
      workflowDefinitionId: '42',
      payloadMapping: { orderId: 'selection.id' },
    };
    let latestActions: DesignerDynamicAction[] = [action];

    const { rerender } = render(
      <InspectorDynamicActionsField
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        trueActions={latestActions}
        onChange={(next) => { latestActions = next; }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('selection.id'), { target: { value: 'selection.orderId' } });

    // Equivalent to hand-typing `{"orderId":"selection.orderId"}` into the old JSON input.
    expect(latestActions[0]?.payloadMapping).toEqual({ orderId: 'selection.orderId' });

    rerender(
      <InspectorDynamicActionsField
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        trueActions={latestActions}
        onChange={(next) => { latestActions = next; }}
      />,
    );
  });

  it('clearing the only mapping row leaves payloadMapping undefined (matches typing "{}" / clearing the old input)', () => {
    const action: DesignerDynamicAction = {
      ...createDynamicAction('triggerWorkflow'),
      workflowDefinitionId: '42',
      payloadMapping: { orderId: 'selection.id' },
    };
    let latestActions: DesignerDynamicAction[] = [action];

    render(
      <InspectorDynamicActionsField
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        trueActions={latestActions}
        onChange={(next) => { latestActions = next; }}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove payload mapping row'));

    expect(latestActions[0]?.payloadMapping).toBeUndefined();
  });
});
