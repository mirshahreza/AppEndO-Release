/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormField } from '../FormSection';
import { FormAccessorySlot } from '../formTabOrder';
import { UiInput } from '../HeroFieldControls';
import { UiOptionCardGroup } from '../UiOptionCardGroup';

afterEach(cleanup);

const sequentialTabStops = (container: HTMLElement): HTMLElement[] => (
  [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled)
);

describe('form tab order', () => {
  it('skips accessory slot buttons so Tab visits neighboring fields', () => {
    const { container } = render(
      <div>
        <input aria-label="first" />
        <FormAccessorySlot>
          <button type="button">Generate</button>
        </FormAccessorySlot>
        <input aria-label="second" />
      </div>,
    );

    const stops = sequentialTabStops(container).map((el) => el.getAttribute('aria-label') || el.textContent);
    expect(stops).toEqual(['first', 'second']);
    expect(screen.getByRole('button', { name: 'Generate' }).tabIndex).toBe(-1);
  });

  it('skips field hint and label-extra chrome between inputs', () => {
    const { container } = render(
      <div>
        <FormField label="Title" hint="Shown on the list.">
          <UiInput ariaLabel="Title" />
        </FormField>
        <FormField
          label="Code"
          labelExtra={<button type="button" aria-label="AI assistant for Code">sparkle</button>}
        >
          <UiInput ariaLabel="Code" />
        </FormField>
      </div>,
    );

    const stops = sequentialTabStops(container);
    expect(stops.map((el) => el.getAttribute('aria-label'))).toEqual(['Title', 'Code']);
    expect(screen.getByRole('button', { name: 'About Title' }).tabIndex).toBe(-1);
    expect(screen.getByRole('button', { name: 'AI assistant for Code' }).tabIndex).toBe(-1);
  });

  it('skips start and end adornment buttons on UiInput', () => {
    const { container } = render(
      <div>
        <UiInput
          ariaLabel="Slug"
          startContent={<button type="button">Prefix</button>}
          endContent={<button type="button">Generate</button>}
        />
        <UiInput ariaLabel="Name" />
      </div>,
    );

    expect(sequentialTabStops(container).map((el) => el.getAttribute('aria-label'))).toEqual(['Slug', 'Name']);
    expect(screen.getByRole('button', { name: 'Prefix' }).tabIndex).toBe(-1);
    expect(screen.getByRole('button', { name: 'Generate' }).tabIndex).toBe(-1);
  });

  it('gives option cards one tab stop per group and moves with arrows', () => {
    const { container, rerender } = render(
      <UiOptionCardGroup
        ariaLabel="Provider"
        value="sqlite"
        onChange={() => undefined}
        columns={2}
        options={[
          { value: 'sqlite', title: 'SQLite' },
          { value: 'pg', title: 'PostgreSQL' },
          { value: 'mysql', title: 'MySQL' },
        ]}
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'SQLite' }).tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'PostgreSQL' }).tabIndex).toBe(-1);
    expect(sequentialTabStops(container)).toHaveLength(1);

    let selected = 'sqlite';
    const onChange = (next: string) => {
      selected = next;
    };
    rerender(
      <UiOptionCardGroup
        ariaLabel="Provider"
        value={selected}
        onChange={onChange}
        columns={2}
        options={[
          { value: 'sqlite', title: 'SQLite' },
          { value: 'pg', title: 'PostgreSQL' },
          { value: 'mysql', title: 'MySQL' },
        ]}
      />,
    );

    fireEvent.keyDown(screen.getByRole('radio', { name: 'SQLite' }), { key: 'ArrowRight' });
    expect(selected).toBe('pg');
  });
});
