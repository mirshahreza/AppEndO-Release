// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorBindablePropField } from '../InspectorPropBindingControl';
import { HEROUI_PALETTE_PROP_FIELD_MAP } from '../../../../domain/component-designer/inspectorPaletteFields';
import { createDefaultBindingDefinitions } from '../../../../domain/component-designer/bindingRegistry';
import type { DesignerDocument, DesignerNode } from '../../../../domain/component-designer/types';

afterEach(() => {
  cleanup();
});

// Real catalog field definition (not a hand-rolled fixture) — proves the actual
// `viz.chart-pie` gauge-thresholds field is wired with `arrayEditorColumns`.
const GAUGE_THRESHOLDS_FIELD = HEROUI_PALETTE_PROP_FIELD_MAP['viz.chart-pie']?.find(
  (field) => field.key === 'gaugeThresholds',
);

const document: DesignerDocument = {
  schemaVersion: '1.0.0',
  id: 'doc-1',
  name: 'Doc',
  rootNodeId: 'root',
  nodes: {},
  metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  diagnostics: [],
};

const buildNode = (gaugeThresholdsJson: string | undefined): DesignerNode => ({
  id: 'gauge-1',
  type: 'div',
  parentId: null,
  order: 0,
  props: {
    chartVariant: 'gauge',
    ...(gaugeThresholdsJson !== undefined ? { gaugeThresholds: gaugeThresholdsJson } : {}),
  },
  layout: {},
  binding: {},
  children: [],
});

describe('InspectorBindablePropField — gaugeThresholds routes to InspectorJsonArrayListField', () => {
  it('the catalog field carries arrayEditorColumns for value (number) + color', () => {
    expect(GAUGE_THRESHOLDS_FIELD?.arrayEditorColumns).toEqual([
      { key: 'value', label: 'Value', type: 'number', placeholder: '70' },
      { key: 'color', label: 'Color', type: 'color', placeholder: '#f59e0b' },
    ]);
  });

  it('renders visual rows (number + color inputs) instead of the raw-JSON dialog trigger', () => {
    if (!GAUGE_THRESHOLDS_FIELD) throw new Error('gaugeThresholds field not found in catalog');

    const node = buildNode(JSON.stringify([{ value: 70, color: '#f59e0b' }]));

    render(
      <InspectorBindablePropField
        node={node}
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        field={GAUGE_THRESHOLDS_FIELD}
        setProp={() => {}}
        dispatch={() => {}}
      />,
    );

    // The old path rendered a "More" / dialog-opener button with no typed inputs on the surface.
    expect(screen.getByLabelText('threshold 1 Value')).toHaveValue(70);
    expect(screen.getByLabelText('threshold 1 Color')).toHaveValue('#f59e0b');
  });

  it('editing the visual rows calls setProp with the same JSON-string-encoded array the raw dialog would have produced', () => {
    if (!GAUGE_THRESHOLDS_FIELD) throw new Error('gaugeThresholds field not found in catalog');

    const node = buildNode(JSON.stringify([{ value: 70, color: '#f59e0b' }]));
    let lastSetPropValue: unknown;

    render(
      <InspectorBindablePropField
        node={node}
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        field={GAUGE_THRESHOLDS_FIELD}
        setProp={(key, value) => {
          expect(key).toBe('gaugeThresholds');
          lastSetPropValue = value;
        }}
        dispatch={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('threshold 1 Value'), { target: { value: '85' } });

    expect(lastSetPropValue).toBe(JSON.stringify([{ value: 85, color: '#f59e0b' }]));
  });

  it('an unset gaugeThresholds prop shows the empty state, not "Not set"', () => {
    if (!GAUGE_THRESHOLDS_FIELD) throw new Error('gaugeThresholds field not found in catalog');

    const node = buildNode(undefined);

    render(
      <InspectorBindablePropField
        node={node}
        document={document}
        bindingDefinitions={createDefaultBindingDefinitions()}
        field={GAUGE_THRESHOLDS_FIELD}
        setProp={() => {}}
        dispatch={() => {}}
      />,
    );

    expect(screen.getByText('No thresholds yet.')).toBeInTheDocument();
  });
});
