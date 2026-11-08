// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  applyUiSplitPaneDrag,
  buildUiSplitPaneSizes,
  UiSplitPane,
} from '../UiSplitPane';

afterEach(() => {
  cleanup();
});

describe('UiSplitPane', () => {
  it('builds two-pane sizes from defaultSplit', () => {
    expect(buildUiSplitPaneSizes(2, 35)).toEqual([35, 65]);
    expect(applyUiSplitPaneDrag([50, 50], 0, -20)).toEqual([30, 70]);
  });

  it('drags the splitter to resize panes', () => {
    render(
      <UiSplitPane defaultSplit={50} data-testid="split">
        <div>Left</div>
        <div>Right</div>
      </UiSplitPane>,
    );

    const root = screen.getByTestId('split');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 120,
      top: 0,
      left: 0,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const first = root.querySelector('[data-split-pane-index="0"]') as HTMLElement;
    expect(first.style.width).toBe('50%');

    const splitter = screen.getByRole('separator', { name: 'Drag to resize' });
    fireEvent.pointerDown(splitter, { pointerId: 1, button: 0, clientX: 100, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 60, clientY: 20 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 60, clientY: 20 });

    expect(first.style.width).toBe('30%');
  });
});
