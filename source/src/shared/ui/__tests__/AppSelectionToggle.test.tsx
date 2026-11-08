/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppSelectionToggle } from '../AppSelectionToggle';
import { SOFT_TONE_CLASS } from '../paletteHues';

afterEach(cleanup);

describe('AppSelectionToggle', () => {
  it('paints selected chips mild emerald with a check icon', () => {
    render(<AppSelectionToggle selected>Title</AppSelectionToggle>);
    const button = screen.getByRole('button', { name: 'Title' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toContain(SOFT_TONE_CLASS.emerald);
    expect(button.querySelector('svg.lucide-check')).toBeInTheDocument();
  });

  it('paints unselected chips slate with an X icon', () => {
    render(<AppSelectionToggle selected={false}>Title</AppSelectionToggle>);
    const button = screen.getByRole('button', { name: 'Title' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.className).toContain(SOFT_TONE_CLASS.slate);
    expect(button.querySelector('svg.lucide-x')).toBeInTheDocument();
  });
});
