// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LiveDesignerDropMarker } from '../LiveDesignerDropMarker';

afterEach(() => {
  cleanup();
});

describe('LiveDesignerDropMarker', () => {
  it('renders a line marker with knobs', () => {
    render(
      <LiveDesignerDropMarker
        indicator={{ kind: 'line', top: 40, left: 8, width: 200, height: 4 }}
      />,
    );
    expect(screen.getByTestId('live-designer-drop-indicator')).toHaveAttribute('data-drop-kind', 'line');
  });

  it('renders a drop-inside badge on container targets', () => {
    render(
      <LiveDesignerDropMarker
        indicator={{ kind: 'container', top: 0, left: 0, width: 240, height: 120 }}
      />,
    );
    const marker = screen.getByTestId('live-designer-drop-indicator');
    expect(marker).toHaveAttribute('data-drop-kind', 'container');
    expect(marker).toHaveTextContent('Drop inside');
  });

  it('renders an invalid drop outline', () => {
    render(
      <LiveDesignerDropMarker
        indicator={{ kind: 'invalid', top: 10, left: 10, width: 80, height: 24 }}
      />,
    );
    expect(screen.getByTestId('live-designer-drop-indicator')).toHaveAttribute('data-drop-kind', 'invalid');
  });
});
