// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InspectorContentRecordsField } from '../InspectorContentRecordsField';
import type { DesignerNode } from '../../../../domain/component-designer/types';

/**
 * Bug found (parity audit item P4.21): marketing.pricing-table's `featured` field needed a
 * real checkbox control in the structured content-records editor — the shared per-record
 * storage model is `Record<string, string>`, so a checkbox must persist the string
 * "true"/"false" (not a real boolean), and the widget reading it back must accept that string
 * form (see DesignerRuntimeUniversalWidgets.tsx's DesignerUniversalPricingTable normalization).
 */

const buildNode = (dataJson: string): DesignerNode => ({
  id: 'pricing-1',
  type: 'container',
  parentId: null,
  order: 0,
  props: { data: dataJson },
  layout: {},
  binding: {},
  children: [],
});

describe('InspectorContentRecordsField checkbox control', () => {
  it('toggling the checkbox persists "true"/"false" strings via dispatch', () => {
    const node = buildNode(JSON.stringify([{ id: 'starter', name: 'Starter', featured: 'false' }]));
    const dispatched: unknown[] = [];

    render(
      <InspectorContentRecordsField
        node={node}
        dispatch={(action) => dispatched.push(action)}
        propKey="data"
        title="Pricing tiers"
        itemLabel="tier"
        fields={[
          { key: 'name', label: 'Name' },
          { key: 'featured', label: 'Featured', control: 'checkbox' },
        ]}
      />,
    );

    const checkbox = screen.getByText('Featured').closest('label')?.querySelector('input[type="checkbox"]')
      ?? document.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    fireEvent.click(checkbox!);

    const lastAction = dispatched.at(-1) as { type: string; key: string; value: string };
    expect(lastAction.type).toBe('set-node-prop');
    expect(lastAction.key).toBe('data');
    const parsed = JSON.parse(lastAction.value);
    expect(parsed[0].featured).toBe('true');
  });
});
