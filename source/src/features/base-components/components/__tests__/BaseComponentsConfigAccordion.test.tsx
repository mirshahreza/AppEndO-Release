/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormSection } from '../../../../shared/ui';
import {
  BaseComponentsConfigAccordion,
  collectBaseComponentsConfigSections,
} from '../BaseComponentsConfigAccordion';
import { markBaseComponentsConfigSectionSource } from '../baseComponentsConfigSectionSource';
import { BaseComponentsGridPresentationFields } from '../BaseComponentsGridPresentationFields';
import {
  BaseComponentsGridPagingFields,
  DEFAULT_GRID_PAGING_DEMO_CONFIG,
} from '../BaseComponentsGridPagingFields';
import { BaseComponentsCrudSetPagingFields } from '../BaseComponentsCrudSetPagingFields';
import { BaseComponentsCrudSetToolbarFields } from '../BaseComponentsCrudSetToolbarFields';
import {
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
} from '../../../../domain/component-designer/crudSetSpec';

describe('collectBaseComponentsConfigSections', () => {
  it('flattens FormSection groups and fragments into accordion items', () => {
    const items = collectBaseComponentsConfigSections(
      <>
        <FormSection title="Shell">fields</FormSection>
        {true ? <FormSection title="Bands">bands</FormSection> : null}
      </>,
    );
    expect(items.map((item) => item.id)).toEqual(['shell', 'bands']);
    expect(items.map((item) => item.title)).toEqual(['Shell', 'Bands']);
  });

  it('unwraps grid presentation and paging field groups into accordion items', () => {
    const items = collectBaseComponentsConfigSections(
      <>
        <FormSection title="Layout">layout</FormSection>
        <BaseComponentsGridPresentationFields
          config={{
            presentation: 'auto',
            cardBelow: 'phone',
            compactPhoneLayout: 'inherit',
            compactTabletLayout: 'inherit',
            compactShowActions: true,
          }}
          onChange={() => undefined}
        />
        <BaseComponentsGridPagingFields
          config={DEFAULT_GRID_PAGING_DEMO_CONFIG}
          onChange={() => undefined}
        />
      </>,
    );
    expect(items.map((item) => item.title)).toEqual([
      'Layout',
      'Presentation',
      'Compact viewport',
      'Paging',
    ]);
  });

  it('unwraps crud set paging into its own accordion item', () => {
    const items = collectBaseComponentsConfigSections(
      <>
        <FormSection title="Body">body</FormSection>
        <BaseComponentsCrudSetPagingFields
          listBody="grid"
          pagination
          paging={CRUD_SET_DEFAULT_PAGING}
          sorting={CRUD_SET_DEFAULT_SORTING}
          columns={[]}
          onPaginationChange={() => undefined}
          onPagingChange={() => undefined}
          onSortingChange={() => undefined}
        />
      </>,
    );
    expect(items.map((item) => item.title)).toEqual(['Body', 'Paging']);
  });

  it('unwraps crud set toolbar into one accordion item', () => {
    const items = collectBaseComponentsConfigSections(
      <>
        <FormSection title="Columns">columns</FormSection>
        <BaseComponentsCrudSetToolbarFields
          filterBar={{ enabled: true, search: true, filters: [] }}
          onFilterBarChange={() => undefined}
          exportEnabled
          exportFormats={['xlsx']}
          exportFormat="xlsx"
          refreshEnabled
          onExportEnabledChange={() => undefined}
          onExportFormatsChange={() => undefined}
          onExportFormatChange={() => undefined}
          onRefreshEnabledChange={() => undefined}
          fieldOptions={[]}
          onAddFilter={() => undefined}
        />
      </>,
    );
    expect(items.map((item) => item.title)).toEqual(['Columns', 'Toolbar']);
  });

  it('unwraps marked nested groups even when the function identity is not imported', () => {
    const Nested: React.FC & { unwrapConfigSections?: true } = () => (
      <>
        <FormSection title="Presentation">presentation</FormSection>
        <FormSection title="Compact viewport">compact</FormSection>
        <FormSection title="Paging">paging</FormSection>
      </>
    );
    markBaseComponentsConfigSectionSource(Nested);

    expect(collectBaseComponentsConfigSections(<Nested />).map((item) => item.title)).toEqual([
      'Presentation',
      'Compact viewport',
      'Paging',
    ]);
  });
});

describe('BaseComponentsConfigAccordion', () => {
  afterEach(cleanup);

  it('renders a fill accordion that always keeps one section open', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">Shell fields</FormSection>
          <FormSection title="Bands">Band fields</FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    const shellTrigger = screen.getByRole('button', { name: /shell/i });
    expect(shellTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(shellTrigger).toHaveClass('h-8');
    expect(shellTrigger.className).toContain('--app-accent-wash');
    expect(shellTrigger.className).toContain('--app-accent-700');
    expect(shellTrigger.className).toContain('color-mix');
    expect(screen.getByText('Shell fields')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /bands/i }));
    expect(screen.getByRole('button', { name: /bands/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /shell/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Band fields')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /bands/i }));
    expect(screen.getByRole('button', { name: /bands/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('scrolls the open panel with the page Scroll Area chrome', () => {
    const { container } = render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">Shell fields</FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    const host = container.querySelector('[data-ui-scroll-area]');
    expect(host).toHaveAttribute('data-variant', 'nudge');
    expect(host).toHaveAttribute('data-axis', 'vertical');
    expect(host).toHaveAttribute('data-nudge-placement', 'overlay');
    expect(host).not.toHaveAttribute('data-nudge-visible');
    expect(host).toHaveAttribute('data-nudge-reveal', 'pointer');
    expect(host).toHaveAttribute('data-nudge-slot', 'band');
    expect(host).toHaveAttribute('data-nudge-icon-size', '18');
    expect(host).toHaveAttribute('data-nudge-mark', 'button');
    expect(host).toHaveAttribute('data-nudge-shape', 'circle');
    expect(screen.getByLabelText('Shell options')).toHaveClass('ui-scroll-area-hide-thumb');
    expect(screen.getByText('Shell fields')).toBeVisible();
  });

  it('does not render an orphaned info icon for FormSection hint', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Field group" hint="Choose a field group — the preview shows only that group.">
            Group options
          </FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    expect(screen.queryByRole('button', { name: /about field group/i })).not.toBeInTheDocument();
    expect(screen.getByText('Group options')).toBeVisible();
  });
});
