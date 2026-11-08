// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorKeyValueListField } from '../InspectorKeyValueListField';

afterEach(() => {
  cleanup();
});

describe('InspectorKeyValueListField', () => {
  it('renders one empty row when value is undefined', () => {
    render(
      <InspectorKeyValueListField
        value={undefined}
        onChange={() => {}}
        fieldLabel="Header"
      />,
    );

    expect(screen.getAllByLabelText('Header key')).toHaveLength(1);
    expect(screen.getAllByLabelText('Header value')).toHaveLength(1);
  });

  it('renders one row per existing key/value pair', () => {
    render(
      <InspectorKeyValueListField
        value={{ Authorization: 'Bearer token', 'X-Custom': 'value' }}
        onChange={() => {}}
        fieldLabel="Header"
      />,
    );

    const keyInputs = screen.getAllByLabelText('Header key') as HTMLInputElement[];
    const valueInputs = screen.getAllByLabelText('Header value') as HTMLInputElement[];
    expect(keyInputs).toHaveLength(2);
    expect(keyInputs.map((input) => input.value).sort()).toEqual(['Authorization', 'X-Custom']);
    expect(valueInputs.map((input) => input.value).sort()).toEqual(['Bearer token', 'value']);
  });

  it('typing a key and value calls onChange with the rebuilt record — no JSON syntax involved', () => {
    let lastValue: Record<string, string> | undefined;

    render(
      <InspectorKeyValueListField
        value={undefined}
        onChange={(next) => { lastValue = next; }}
        fieldLabel="Header"
      />,
    );

    fireEvent.change(screen.getByLabelText('Header key'), { target: { value: 'Authorization' } });
    fireEvent.change(screen.getByLabelText('Header value'), { target: { value: 'Bearer abc' } });

    expect(lastValue).toEqual({ Authorization: 'Bearer abc' });
  });

  it('emptying all rows serializes to undefined, not {}', () => {
    let lastValue: Record<string, string> | undefined = { a: 'b' };

    const { rerender } = render(
      <InspectorKeyValueListField
        value={{ a: 'b' }}
        onChange={(next) => { lastValue = next; }}
        fieldLabel="Header"
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove header row'));

    expect(lastValue).toBeUndefined();

    // Re-render with the new (undefined) value to confirm a single blank row remains, not zero rows.
    rerender(
      <InspectorKeyValueListField
        value={lastValue}
        onChange={() => {}}
        fieldLabel="Header"
      />,
    );
    expect(screen.getAllByLabelText('Header key')).toHaveLength(1);
  });

  it('adding a row via the Add button appends a new blank key/value pair', () => {
    render(
      <InspectorKeyValueListField
        value={{ a: 'b' }}
        onChange={() => {}}
        fieldLabel="Header"
        addLabel="Add"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByLabelText('Header key')).toHaveLength(2);
  });

  it('flags duplicate keys with an inline warning without dropping data (last-write-wins)', () => {
    let lastValue: Record<string, string> | undefined;

    render(
      <InspectorKeyValueListField
        value={{ a: '1' }}
        onChange={(next) => { lastValue = next; }}
        fieldLabel="Header"
        addLabel="Add"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const keyInputs = screen.getAllByLabelText('Header key');
    fireEvent.change(keyInputs[1], { target: { value: 'a' } });

    expect(screen.getAllByText(/Duplicate key/i).length).toBeGreaterThan(0);

    const valueInputs = screen.getAllByLabelText('Header value');
    fireEvent.change(valueInputs[1], { target: { value: '2' } });

    expect(lastValue).toEqual({ a: '2' });
  });

  it('keeps an intentionally blank value for a non-empty key (parity with old JSON headers behavior)', () => {
    let lastValue: Record<string, string> | undefined;

    render(
      <InspectorKeyValueListField
        value={undefined}
        onChange={(next) => { lastValue = next; }}
        fieldLabel="Header"
      />,
    );

    fireEvent.change(screen.getByLabelText('Header key'), { target: { value: 'X-Empty' } });

    expect(lastValue).toEqual({ 'X-Empty': '' });
  });

  it('pads to five blank rows and hides Add when autoPadRows is set', () => {
    render(
      <InspectorKeyValueListField
        value={undefined}
        onChange={() => {}}
        fieldLabel="Query param"
        autoPadRows={5}
      />,
    );

    expect(screen.getAllByLabelText('Query param key')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();
  });

  it('appends a spare row once every padded row has a key', () => {
    render(
      <InspectorKeyValueListField
        value={undefined}
        onChange={() => {}}
        fieldLabel="Header"
        autoPadRows={5}
      />,
    );

    const keys = screen.getAllByLabelText('Header key');
    expect(keys).toHaveLength(5);
    keys.forEach((input, index) => {
      fireEvent.change(input, { target: { value: `h${index}` } });
    });

    expect(screen.getAllByLabelText('Header key')).toHaveLength(6);
  });
});
