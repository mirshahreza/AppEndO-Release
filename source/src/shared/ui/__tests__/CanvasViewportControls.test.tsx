/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasViewportControls } from '../CanvasViewportControls';
import {
  CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS,
  CANVAS_PAN_VIEWPORT_CLASS,
  CANVAS_STAGE_CLASS,
  CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS,
} from '../surfaceClasses';
import { CANVAS_FLOW_CONTROLS_PANEL_CLASS } from '../canvasFlowChrome';

describe('CanvasViewportControls', () => {
  afterEach(cleanup);

  it('exposes zoom in, zoom out, and fit view in one cluster', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFitView = vi.fn();
    render(
      <CanvasViewportControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitView={onFitView}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit view' }));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onFitView).toHaveBeenCalledTimes(1);
  });

  it('disables zoom ends and the whole cluster independently', () => {
    render(
      <CanvasViewportControls
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
        onFitView={() => undefined}
        canZoomIn={false}
        canZoomOut={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit view' })).toBeEnabled();

    cleanup();
    render(
      <CanvasViewportControls
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
        onFitView={() => undefined}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit view' })).toBeDisabled();
  });

  it('pins zoom bottom-left and layout bottom-right', () => {
    expect(CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS).toContain('bottom-3');
    expect(CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS).toContain('left-3');
    expect(CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS).toContain('bottom-3');
    expect(CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS).toContain('right-3');
    expect(CANVAS_FLOW_CONTROLS_PANEL_CLASS).not.toMatch(/top-2|right-2/);
  });

  it('hides native canvas scrollbars', () => {
    expect(CANVAS_PAN_VIEWPORT_CLASS).toContain('ui-scroll-area-hide-thumb');
    expect(CANVAS_PAN_VIEWPORT_CLASS).toContain('overflow-auto');
  });

  it('exposes a dotted slate stage for design canvases', () => {
    expect(CANVAS_STAGE_CLASS).toContain('select-none');
    expect(CANVAS_STAGE_CLASS).toContain('bg-slate-100/80');
    expect(CANVAS_STAGE_CLASS).toContain('bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)]');
    expect(CANVAS_STAGE_CLASS).toContain('[background-size:16px_16px]');
  });
});
