/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModelerInspectorListPreview } from '../ModelerInspectorListPreview';

describe('ModelerInspectorListPreview', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the first five items and expands the rest from and N more', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    render(
      <ModelerInspectorListPreview items={items}>
        {(visible) => visible.map((item) => <span key={item}>{item}</span>)}
      </ModelerInspectorListPreview>,
    );

    expect(screen.getByText('e')).toBeInTheDocument();
    expect(screen.queryByText('f')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show 2 more' })).toHaveTextContent('and 2 more');

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(screen.getByText('g')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('g')).not.toBeInTheDocument();
  });

  it('omits the disclosure link when the list fits the preview', () => {
    render(
      <ModelerInspectorListPreview items={['a', 'b', 'c']}>
        {(visible) => visible.map((item) => <span key={item}>{item}</span>)}
      </ModelerInspectorListPreview>,
    );

    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });
});
