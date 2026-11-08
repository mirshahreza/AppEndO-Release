/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhoneNumberDisplay } from '../PhoneNumberDisplay';

describe('PhoneNumberDisplay', () => {
  it('renders digits in a fixed-width monospace glyph', () => {
    render(<PhoneNumberDisplay phone="07701234567" />);
    const digits = screen.getByText('07701234567');
    expect(digits.className).toContain('font-mono');
    expect(digits.className).toContain('w-[11ch]');
    expect(digits.closest('[dir=ltr]')).toBeTruthy();
  });
});
