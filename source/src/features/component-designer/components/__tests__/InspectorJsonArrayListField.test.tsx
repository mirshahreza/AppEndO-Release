// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorJsonArrayListField } from '../InspectorJsonArrayListField';
import type { InspectorArrayEditorColumn } from '../../../../domain/component-designer/inspectorRegistry';

afterEach(() => {
  cleanup();
});

const GAUGE_THRESHOLD_COLUMNS: InspectorArrayEditorColumn[] = [
  { key: 'value', label: 'Value', type: 'number', placeholder: '70' },
  { key: 'color', label: 'Color', type: 'color', placeholder: '#f59e0b' },
];

const MAP_PIN_COLUMNS: InspectorArrayEditorColumn[] = [
  { key: 'lat', label: 'Latitude', type: 'number' },
  { key: 'lng', label: 'Longitude', type: 'number' },
  { key: 'label', label: 'Label', type: 'string' },
];

describe('InspectorJsonArrayListField', () => {
  it('renders no rows and an empty-state message when value is undefined', () => {
    render(
      <InspectorJsonArrayListField
        columns={GAUGE_THRESHOLD_COLUMNS}
        value={undefined}
        onChange={() => {}}
        itemLabel="threshold"
      />,
    );

    expect(screen.getByText('No thresholds yet.')).toBeInTheDocument();
  });

  it('renders one row per array item with typed inputs matching the JSON shape (parity with old raw-JSON dialog)', () => {
    render(
      <InspectorJsonArrayListField
        columns={GAUGE_THRESHOLD_COLUMNS}
        value={[{ value: 70, color: '#f59e0b' }, { value: 90, color: '#ef4444' }]}
        onChange={() => {}}
        itemLabel="threshold"
      />,
    );

    const valueInputs = screen.getAllByLabelText(/threshold \d Value/) as HTMLInputElement[];
    expect(valueInputs.map((input) => input.value)).toEqual(['70', '90']);

    const colorInputs = screen.getAllByLabelText(/threshold \d Color/) as HTMLInputElement[];
    expect(colorInputs.map((input) => input.value)).toEqual(['#f59e0b', '#ef4444']);
  });

  it('adding a row and filling number + color cells produces a real-typed JSON array', () => {
    let lastValue: unknown[] | undefined;

    render(
      <InspectorJsonArrayListField
        columns={GAUGE_THRESHOLD_COLUMNS}
        value={undefined}
        onChange={(next) => { lastValue = next; }}
        itemLabel="threshold"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add threshold/i }));
    fireEvent.change(screen.getByLabelText('threshold 1 Value'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('threshold 1 Color'), { target: { value: '#f59e0b' } });

    expect(lastValue).toEqual([{ value: 70, color: '#f59e0b' }]);
    // The numeric column must serialize as a real JS number, not a string.
    expect(typeof (lastValue as Array<{ value: unknown }>)[0].value).toBe('number');
  });

  it('removing the last row serializes back to undefined (matches "Not set" for an unset JSON array)', () => {
    let lastValue: unknown[] | undefined = [{ value: 70, color: '#f59e0b' }];

    render(
      <InspectorJsonArrayListField
        columns={GAUGE_THRESHOLD_COLUMNS}
        value={[{ value: 70, color: '#f59e0b' }]}
        onChange={(next) => { lastValue = next; }}
        itemLabel="threshold"
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove threshold 1'));
    expect(lastValue).toBeUndefined();
  });

  it('reorders rows with the up/down controls, preserving each row\'s full field set', () => {
    let lastValue: unknown[] | undefined;

    render(
      <InspectorJsonArrayListField
        columns={MAP_PIN_COLUMNS}
        value={[
          { lat: 35.6, lng: 51.4, label: 'HQ' },
          { lat: 40.7, lng: -74, label: 'NYC' },
        ]}
        onChange={(next) => { lastValue = next; }}
        itemLabel="pin"
      />,
    );

    fireEvent.click(screen.getByLabelText('Move pin 2 up'));

    expect(lastValue).toEqual([
      { lat: 40.7, lng: -74, label: 'NYC' },
      { lat: 35.6, lng: 51.4, label: 'HQ' },
    ]);
  });

  it('editing a string column leaves sibling number columns as real numbers (mixed-type row round-trip)', () => {
    let lastValue: unknown[] | undefined;

    render(
      <InspectorJsonArrayListField
        columns={MAP_PIN_COLUMNS}
        value={[{ lat: 35.6, lng: 51.4, label: 'HQ' }]}
        onChange={(next) => { lastValue = next; }}
        itemLabel="pin"
      />,
    );

    fireEvent.change(screen.getByLabelText('pin 1 Label'), { target: { value: 'Updated HQ' } });

    expect(lastValue).toEqual([{ lat: 35.6, lng: 51.4, label: 'Updated HQ' }]);
    const [row] = lastValue as Array<{ lat: unknown; lng: unknown }>;
    expect(typeof row.lat).toBe('number');
    expect(typeof row.lng).toBe('number');
  });

  it('leaving a number cell blank omits that key from the serialized row', () => {
    let lastValue: unknown[] | undefined;

    render(
      <InspectorJsonArrayListField
        columns={GAUGE_THRESHOLD_COLUMNS}
        value={[{ value: 70, color: '#f59e0b' }]}
        onChange={(next) => { lastValue = next; }}
        itemLabel="threshold"
      />,
    );

    fireEvent.change(screen.getByLabelText('threshold 1 Value'), { target: { value: '' } });

    expect(lastValue).toEqual([{ color: '#f59e0b' }]);
  });
});
