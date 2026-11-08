/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UiSelect } from '../HeroFieldControls';
import { ToolbarFilterSelect } from '../ToolbarFilterSelect';

afterEach(() => {
  cleanup();
});

describe('UiSelect multiple', () => {
  it('toggles several options and emits a comma-separated value', async () => {
    const handleChange = vi.fn();

    const Host: React.FC = () => {
      const [value, setValue] = React.useState('');
      return (
        <UiSelect
          multiple
          value={value}
          ariaLabel="Environments"
          placeholder="Pick environments…"
          onChange={(event) => {
            handleChange(event.target.value);
            setValue(event.target.value);
          }}
        >
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </UiSelect>
      );
    };

    render(<Host />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Environments|Pick environments/i }));
    });

    const production = await screen.findByRole('option', { name: 'Production' });
    await act(async () => {
      fireEvent.click(production);
    });

    expect(handleChange).toHaveBeenCalled();
    const first = String(handleChange.mock.calls.at(-1)?.[0] ?? '');
    expect(first.split(',').map((entry) => entry.trim())).toContain('production');

    expect(screen.getByRole('option', { name: 'Production' }).getAttribute('aria-selected')).toBe('true');
    expect(
      screen.getByRole('option', { name: 'Production' }).querySelector('[data-slot="list-box-item-indicator"]'),
    ).toBeTruthy();

    const staging = await screen.findByRole('option', { name: 'Staging' });
    await act(async () => {
      fireEvent.click(staging);
    });
    const second = String(handleChange.mock.calls.at(-1)?.[0] ?? '');
    expect(second.split(',').map((entry) => entry.trim()).sort()).toEqual(['production', 'staging']);
    expect(screen.getByRole('option', { name: 'Staging' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('ToolbarFilterSelect', () => {
  it('renders a HeroUI trigger with a clear filter label for the empty selection', () => {
    const handleChange = vi.fn();

    render(
      <ToolbarFilterSelect
        value=""
        ariaLabel="Status"
        allLabel="All"
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
        ]}
        onChange={handleChange}
      />,
    );

    expect(screen.getByRole('button', { name: /Status/i }).textContent).toContain('Status: All');
  });

  it('renders multi-select via UiSelect and summarizes several selections', () => {
    const handleChange = vi.fn();

    render(
      <ToolbarFilterSelect
        multiple
        value="draft,published,archived"
        ariaLabel="Status"
        allLabel="All"
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
          { value: 'archived', label: 'Archived' },
        ]}
        onChange={handleChange}
      />,
    );

    expect(screen.getByRole('button', { name: /Status/i }).textContent).toMatch(/3 selected|Draft/);
  });

  it('groups AND/OR match logic inside the open menu, not beside the trigger', async () => {
    const handleMatchLogicChange = vi.fn();

    render(
      <ToolbarFilterSelect
        multiple
        value=""
        ariaLabel="Roles"
        allLabel="All"
        matchLogic="or"
        onMatchLogicChange={handleMatchLogicChange}
        options={[
          { value: 'ADMIN', label: 'ADMIN' },
          { value: 'DEVELOPER', label: 'DEVELOPER' },
        ]}
        onChange={() => undefined}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Roles match logic' })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Roles'));
    });

    expect(await screen.findByTestId('ui-select-popover-header')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Roles match logic' })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'AND' }));
    });
    expect(handleMatchLogicChange).toHaveBeenCalledWith('and');
  });

  it('tags the filter for the page guide', () => {
    render(
      <ToolbarFilterSelect
        value=""
        ariaLabel="Status"
        options={[{ value: 'draft', label: 'Draft' }]}
        onChange={() => undefined}
      />,
    );

    const host = screen.getByRole('button', { name: /Status/i }).closest('[data-page-guide]');
    expect(host?.getAttribute('data-page-guide-title')).toBe('Status');
    expect(host?.getAttribute('data-page-guide-hint')).toBeTruthy();
  });
});
