// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LiveDesignerViewport } from '../LiveDesignerViewport';

afterEach(() => {
  cleanup();
});

describe('LiveDesignerViewport', () => {
  it('renders the restored width and height', () => {
    render(
      <LiveDesignerViewport width={900} height={640}>
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    const viewport = screen.getByTestId('live-designer-viewport');
    expect(viewport).toHaveAttribute('data-width', '900');
    expect(viewport).toHaveAttribute('data-height', '640');
  });

  it('keeps the colored stage behind the canvas at 100% of the designer area', () => {
    render(
      <LiveDesignerViewport width={900} height={640}>
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    const stage = screen.getByTestId('live-designer-canvas-stage');
    expect(stage.className).toContain('absolute');
    expect(stage.className).toContain('inset-0');
    expect(stage.className).toContain('bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)]');
    expect(stage.className).toContain('[background-size:16px_16px]');
  });

  it('reports the new size when the corner handle is released', () => {
    const onSizeChange = vi.fn();
    render(
      <LiveDesignerViewport width={1280} height={800} onSizeChange={onSizeChange}>
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    const handle = screen.getByRole('button', { name: 'Resize viewport from bottom-right corner' });
    fireEvent.pointerDown(handle, { clientX: 1280, clientY: 800, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 1480, clientY: 900, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 1480, clientY: 900, pointerId: 1 });

    expect(onSizeChange).toHaveBeenCalledWith({ width: 1480, height: 900 });
  });

  it('toggles fill height 100% from the corner cluster', () => {
    const onFillModeChange = vi.fn();
    render(
      <LiveDesignerViewport fillMode="manual" onFillModeChange={onFillModeChange}>
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fill canvas height 100%' }));
    expect(onFillModeChange).toHaveBeenCalledWith('fill-height');
  });

  it('restores the last fixed height from fill 100%', () => {
    const onFillModeChange = vi.fn();
    render(
      <LiveDesignerViewport width={900} fillMode="fill-height" onFillModeChange={onFillModeChange}>
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    const viewport = screen.getByTestId('live-designer-viewport');
    expect(viewport).toHaveAttribute('data-fill', 'height');
    expect(viewport).toHaveAttribute('data-width', '900');
    expect(viewport.className).toContain('max-h-full');
    expect(viewport.className).toContain('min-h-0');
    expect(screen.getByTestId('live-designer-canvas-stage').className).toContain('flex-col');
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore canvas height' }));
    expect(onFillModeChange).toHaveBeenCalledWith('manual');
  });

  it('leaves fill height 100% when the corner handle is dragged', () => {
    const onFillModeChange = vi.fn();
    render(
      <LiveDesignerViewport
        width={1280}
        height={800}
        fillMode="fill-height"
        onFillModeChange={onFillModeChange}
      >
        <div>canvas</div>
      </LiveDesignerViewport>,
    );

    const handle = screen.getByRole('button', { name: 'Resize viewport from bottom-right corner' });
    fireEvent.pointerDown(handle, { clientX: 1280, clientY: 800, pointerId: 1 });

    expect(onFillModeChange).toHaveBeenCalledWith('manual');
  });
});
