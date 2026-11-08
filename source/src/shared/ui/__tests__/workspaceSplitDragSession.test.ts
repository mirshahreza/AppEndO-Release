// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginWorkspaceSplitMouseDrag,
  beginWorkspaceSplitPointerDrag,
} from '../workspaceSplitDragSession';

describe('workspaceSplitDragSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ends mouse drag on mouseup and removes listeners', () => {
    const onMove = vi.fn();
    const onFinish = vi.fn();

    beginWorkspaceSplitMouseDrag({ onMove, onFinish });

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }));
    expect(onMove).toHaveBeenCalledWith(10, 20);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(onFinish).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40 }));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('ends pointer drag on pointerup', () => {
    const element = document.createElement('div');
    element.setPointerCapture = vi.fn();
    element.hasPointerCapture = vi.fn(() => true);
    element.releasePointerCapture = vi.fn();

    const onMove = vi.fn();
    const onFinish = vi.fn();

    beginWorkspaceSplitPointerDrag({
      pointerId: 1,
      captureElement: element,
      onMove,
      onFinish,
    });

    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 60 }));
    expect(onMove).toHaveBeenCalledWith(50, 60);

    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(element.releasePointerCapture).toHaveBeenCalledWith(1);

    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 70, clientY: 80 }));
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});
