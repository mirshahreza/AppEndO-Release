/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BuiltInBadge, CatalogSystemTagBadge, CatalogSystemTagDot } from '../CatalogSystemTagBadge';

describe('CatalogSystemTagBadge', () => {
  it('renders the builtin catalog chip chrome and label', () => {
    render(<BuiltInBadge />);
    const badge = screen.getByText('builtin');
    expect(badge).toHaveClass('border-amber-200', 'bg-amber-50', 'text-amber-800');
    expect(badge).toHaveClass('rounded', 'text-[10px]', 'font-bold', 'uppercase');
  });

  it('falls back to custom chrome for unknown tags', () => {
    render(<CatalogSystemTagBadge tag="unknown" />);
    expect(screen.getByText('unknown')).toHaveClass('border-emerald-200');
  });

  it('renders a type dot with the matching hue and hover title', () => {
    const { rerender } = render(<CatalogSystemTagDot tag="shell" />);
    const dot = screen.getByLabelText('Shell');
    expect(dot).toHaveClass('rounded-full', 'bg-indigo-500');
    expect(dot).toHaveAttribute('title', 'Shell');

    rerender(<CatalogSystemTagDot tag="builtin" />);
    expect(screen.getByLabelText('BuiltIn')).toHaveClass('bg-amber-500');
    expect(screen.getByLabelText('BuiltIn')).toHaveAttribute('title', 'BuiltIn');
  });
});
