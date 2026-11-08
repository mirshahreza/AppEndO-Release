/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasToolbar } from '../CanvasToolbar';

describe('CanvasToolbar option liveness', () => {
  afterEach(cleanup);

  it('maps position, layout, and width options to observable composition', () => {
    const { rerender } = render(
      <CanvasToolbar position="top-left" layout="stack" fullWidthButtons>
        <button type="button">Tool</button>
      </CanvasToolbar>,
    );

    const anchor = screen.getByText('Tool').parentElement?.parentElement;
    expect(anchor).toHaveAttribute('data-position', 'top-left');
    expect(screen.getByText('Tool').parentElement).toHaveAttribute('data-layout', 'stack');
    expect(screen.getByText('Tool').parentElement).toHaveAttribute('data-full-width-buttons', 'true');

    rerender(
      <CanvasToolbar position="bottom-right" layout="row" fullWidthButtons={false}>
        <button type="button">Tool</button>
      </CanvasToolbar>,
    );
    expect(anchor).toHaveAttribute('data-position', 'bottom-right');
    expect(screen.getByText('Tool').parentElement).toHaveAttribute('data-layout', 'row');
  });
});
