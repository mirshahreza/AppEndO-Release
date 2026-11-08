/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DirectionalText } from '../DirectionalText';

describe('DirectionalText', () => {
  it('renders RTL user text with matching direction and alignment', () => {
    render(<DirectionalText as="span" text="یادداشت فارسی" />);

    const text = screen.getByText('یادداشت فارسی');
    expect(text.tagName).toBe('SPAN');
    expect(text.getAttribute('dir')).toBe('rtl');
    expect(text.className).toContain('text-right');
  });

  it('renders LTR user text with matching direction and alignment', () => {
    render(<DirectionalText text="Operator note" />);

    const text = screen.getByText('Operator note');
    expect(text.getAttribute('dir')).toBe('ltr');
    expect(text.className).toContain('text-left');
  });
});
