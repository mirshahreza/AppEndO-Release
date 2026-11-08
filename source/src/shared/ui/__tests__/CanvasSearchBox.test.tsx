/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasSearchBox } from '../CanvasSearchBox';

describe('CanvasSearchBox', () => {
  afterEach(cleanup);

  it('anchors AppSearchBox at top-left', () => {
    render(
      <CanvasSearchBox
        value=""
        onChange={() => undefined}
        placeholder="Search…"
        ariaLabel="Search canvas"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Search canvas' });
    expect(input).toBeInTheDocument();
    expect(input.closest('[data-position]')).toHaveAttribute('data-position', 'top-left');
  });
});
