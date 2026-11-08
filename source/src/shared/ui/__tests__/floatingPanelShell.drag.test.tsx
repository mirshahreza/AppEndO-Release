// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FloatingPanelShell } from '../FloatingPanelShell';

afterEach(() => {
  cleanup();
});

describe('FloatingPanelShell drag after resize', () => {
  it('keeps the window movable after a resize gesture ends', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    render(
      <FloatingPanelShell
        open
        onClose={() => undefined}
        title="Toolbox"
        bounds={{ minWidth: 260, maxWidth: 480, minHeight: 320 }}
        defaultWidth={300}
        defaultHeight={400}
        initialPosition="bottom-right"
        enableMaximize={false}
        portal={false}
      >
        <p>Palette</p>
      </FloatingPanelShell>,
    );

    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toBeTruthy();
    const resizeHandle = panel!.querySelector('[data-panel-resize]');
    expect(resizeHandle).toBeTruthy();

    fireEvent.pointerDown(resizeHandle!, { pointerId: 1, clientX: 1200, clientY: 700 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 1280, clientY: 760 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 1280, clientY: 760 });

    expect(screen.queryByTestId('floating-panel-gesture-overlay')).not.toBeInTheDocument();
    const rightAfterResize = panel!.style.right;

    fireEvent.pointerDown(panel!, { pointerId: 2, clientX: 900, clientY: 120 });
    fireEvent.pointerMove(document, { pointerId: 2, clientX: 820, clientY: 180 });
    fireEvent.pointerUp(document, { pointerId: 2, clientX: 820, clientY: 180 });

    expect(panel!.style.right).not.toBe(rightAfterResize);
  });

  it('can be moved while minimized', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    render(
      <FloatingPanelShell
        open
        onClose={() => undefined}
        title="Toolbox"
        bounds={{ minWidth: 260, maxWidth: 480, minHeight: 320 }}
        defaultWidth={300}
        defaultHeight={400}
        initialPosition="bottom-right"
        enableMaximize={false}
        enableMinimize
        showCloseButton={false}
        dragFromHeaderOnly
        portal={false}
      >
        <p>Palette</p>
      </FloatingPanelShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));
    expect(screen.queryByText('Palette')).not.toBeInTheDocument();

    const panel = screen.getByText('Toolbox').closest('aside');
    const handle = panel!.querySelector('[data-panel-drag-handle]');
    const rightBefore = panel!.style.right;

    fireEvent.pointerDown(handle!, { pointerId: 1, clientX: 1100, clientY: 80 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 980, clientY: 160 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 980, clientY: 160 });

    expect(panel!.style.right).not.toBe(rightBefore);
  });

  it('docks a minimized window to the bottom-left of the studio content area', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    render(
      <FloatingPanelShell
        open
        onClose={() => undefined}
        title="Toolbox"
        bounds={{ minWidth: 260, maxWidth: 480, minHeight: 320 }}
        defaultWidth={300}
        defaultHeight={400}
        initialPosition="bottom-right"
        enableMaximize={false}
        enableMinimize
        showCloseButton={false}
        minimizedAnchor="bottom-left"
        portal={false}
      >
        <p>Palette</p>
      </FloatingPanelShell>,
    );

    const panel = screen.getByText('Toolbox').closest('aside');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));

    expect(screen.queryByText('Palette')).not.toBeInTheDocument();
    expect(panel!.style.height).toBe('40px');
    expect(Number.parseInt(panel!.style.top, 10)).toBe(836);
    expect(Number.parseInt(panel!.style.right, 10)).toBe(1023);
  });
});
