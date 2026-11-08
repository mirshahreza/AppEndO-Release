// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UiDockPane } from '../UiDockPane';

afterEach(() => {
  cleanup();
});

describe('UiDockPane', () => {
  it('docks left by default as a vertical rail', () => {
    render(<UiDockPane data-testid="dock">Nav</UiDockPane>);
    const root = screen.getByTestId('dock');
    expect(root).toHaveAttribute('data-dock', 'left');
    expect(root.className).toContain('w-64');
    expect(root.className).toContain('h-full');
    expect(root.className).toContain('flex-col');
    expect(root.className).toContain('border-e');
  });

  it.each([
    ['right', 'border-s', 'flex-col', 'w-64'],
    ['top', 'border-b', 'flex-row', 'w-full'],
    ['bottom', 'border-t', 'flex-row', 'w-full'],
  ] as const)('applies %s edge classes', (dock, border, direction, size) => {
    render(<UiDockPane dock={dock} data-testid="dock">Pane</UiDockPane>);
    const root = screen.getByTestId('dock');
    expect(root).toHaveAttribute('data-dock', dock);
    expect(root.className).toContain(border);
    expect(root.className).toContain(direction);
    expect(root.className).toContain(size);
  });
});
