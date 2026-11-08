/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DesignerMaskInputField } from '../DesignerMaskInputField';

afterEach(() => {
  cleanup();
});

describe('DesignerMaskInputField', () => {
  it('limits Iran mobile input to eleven digits with defaultValue', () => {
    render(
      <DesignerMaskInputField
        label="Mobile"
        maskKind="pattern"
        maskPreset="phone-ir-mobile"
        maskPlaceholderChar="_"
        defaultValue=""
        showMaskFormatHint={false}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '12345678901234567890' } });
    expect(input.value.replace(/\D/g, '')).toHaveLength(11);
  });

  it('uses uncontrolled mode when value is undefined', () => {
    render(
      <DesignerMaskInputField
        label="Mobile"
        maskKind="pattern"
        maskPreset="phone-ir-mobile"
        maskPlaceholderChar="_"
        showMaskFormatHint={false}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('09_________');
    expect(input.maxLength).toBe(11);
    expect(input.inputMode).toBe('numeric');
  });

  it('does not render helper text below the input by default', () => {
    const { container } = render(
      <DesignerMaskInputField
        label="Mobile"
        maskKind="pattern"
        maskPreset="phone-ir-mobile"
        defaultValue=""
      />,
    );

    expect(container.textContent).not.toContain('Format:');
  });
});
