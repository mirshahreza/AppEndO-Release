/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormField, FormSection } from '../../../../shared/ui';
import { BaseComponentsConfigAccordion } from '../BaseComponentsConfigAccordion';

describe('BaseComponentsConfigAccordion search and dock', () => {
  afterEach(cleanup);

  it('filters accordion sections and fields from the properties search box', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">
            <FormField label="Intent" reserveHintSlot={false}>Intent field</FormField>
          </FormSection>
          <FormSection title="Bands">
            <FormField label="Tone" reserveHintSlot={false}>Tone field</FormField>
          </FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Search properties' }), {
      target: { value: 'tone' },
    });

    expect(screen.getByRole('button', { name: /bands/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^shell$/i })).not.toBeInTheDocument();
    expect(screen.getByText('Tone field')).toBeVisible();
    expect(screen.queryByText('Intent field')).not.toBeInTheDocument();
  });

  it('shows an empty state when no properties match', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">
            <FormField label="Intent" reserveHintSlot={false}>Intent field</FormField>
          </FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Search properties' }), {
      target: { value: 'no-such-property' },
    });

    expect(screen.getByText('No properties match “no-such-property”.')).toBeInTheDocument();
  });

  it('keeps the first properties section open by default', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">Shell fields</FormSection>
          <FormSection title="Bands">Band fields</FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    expect(screen.getByRole('textbox', { name: 'Search properties' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shell/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Shell fields')).toBeVisible();
  });

  it('undocks the properties rail into a floating window and docks it back', () => {
    render(
      <div style={{ height: 320 }}>
        <BaseComponentsConfigAccordion>
          <FormSection title="Shell">Shell fields</FormSection>
        </BaseComponentsConfigAccordion>
      </div>,
    );

    expect(screen.getByLabelText('Undock properties')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undock properties' }));

    expect(screen.getByRole('button', { name: 'Dock properties' })).toBeInTheDocument();
    expect(document.querySelector('[data-bc-config-mode="floating"]')).toBeInTheDocument();
    expect(screen.getByText('Shell fields')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dock properties' }));
    expect(screen.getByRole('button', { name: 'Undock properties' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dock properties' })).not.toBeInTheDocument();
  });
});
