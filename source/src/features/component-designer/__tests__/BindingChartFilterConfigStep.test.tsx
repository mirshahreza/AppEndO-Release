/**
 * @vitest-environment jsdom
 * Bug found: `createSelectFilter` derived a Dropdown filter's `id` (and therefore its
 * `storePath`) from the suggested API field name — once more filters were added than there were
 * available API fields, the fallback (`availableFields[0]`) was identical for every extra
 * filter, so a second Dropdown filter silently shared state with an earlier one (same storePath
 * → selecting one overwrote the other). `id` must always be unique per filter.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BindingChartFilterConfigStep } from '../components/BindingChartFilterConfigStep';
import type { DesignerChartToolbarConfig } from '../../../domain/component-designer/designerChartToolbarConfig';

afterEach(() => cleanup());

describe('BindingChartFilterConfigStep', () => {
  it('assigns a unique id/storePath to each new Dropdown filter even with fewer available fields than filters', () => {
    let config: DesignerChartToolbarConfig = { enabled: false };
    const onChange = vi.fn((next: DesignerChartToolbarConfig) => {
      config = next;
    });

    const { rerender } = render(
      <BindingChartFilterConfigStep nodeId="chart-1" config={config} onChange={onChange} availableFields={['status']} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add filter/i }));
    rerender(<BindingChartFilterConfigStep nodeId="chart-1" config={config} onChange={onChange} availableFields={['status']} />);
    fireEvent.click(screen.getByRole('button', { name: /Add filter/i }));
    rerender(<BindingChartFilterConfigStep nodeId="chart-1" config={config} onChange={onChange} availableFields={['status']} />);

    const filters = config.selectFilters ?? [];
    expect(filters).toHaveLength(2);
    expect(filters[0]!.id).not.toBe(filters[1]!.id);
    expect(filters[0]!.storePath).not.toBe(filters[1]!.storePath);
  });
});
