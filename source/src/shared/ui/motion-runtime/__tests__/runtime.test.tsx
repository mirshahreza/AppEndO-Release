/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreativeMotionProvider,
  CreativeMotionTarget,
  useRouteCrossfade,
} from '..';

class ImmediateIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = '0px';
  thresholds = [0];
}

function media(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('creative motion runtime', () => {
  const cancel = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now() + 10_000);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    window.matchMedia = vi.fn((query: string) =>
      media(query === '(pointer: coarse)' ? false : false));
    Element.prototype.animate = vi.fn(() => ({
      cancel,
      finish: vi.fn(),
    } as unknown as Animation));
    Element.prototype.getAnimations = vi.fn(() => []);
  });

  afterEach(() => {
    cleanup();
    cancel.mockClear();
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    vi.unstubAllGlobals();
  });

  it('keeps semantic content and focus available while reveal runs, then cleans animation', () => {
    const view = render(
      <CreativeMotionProvider>
        <CreativeMotionTarget config={{ id: 'reveal-slide' }}>
          <button type="button">Continue</button>
        </CreativeMotionTarget>
      </CreativeMotionProvider>,
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.isConnected).toBe(true);
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(Element.prototype.animate).toHaveBeenCalled();
    view.unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it('removes pointer listeners and restores the neutral transform on cleanup', () => {
    const view = render(
      <CreativeMotionProvider>
        <CreativeMotionTarget config={{ id: 'pointer-tilt' }}>Card</CreativeMotionTarget>
      </CreativeMotionProvider>,
    );
    const target = screen.getByText('Card');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100,
      width: 100, height: 100, toJSON: () => ({}),
    });
    fireEvent.pointerMove(target, { clientX: 90, clientY: 10 });
    expect(target.style.transform).toContain('rotateX');
    view.unmount();
    expect(target.style.transform).toBe('');
    fireEvent.pointerMove(target, { clientX: 10, clientY: 90 });
    expect(target.style.transform).toBe('');
  });

  it('projects phone scene behavior and metrics to semantic final states', () => {
    const { rerender } = render(
      <CreativeMotionProvider viewport="phone">
        <CreativeMotionTarget config={{ id: 'scene-scrub' }}>Poster</CreativeMotionTarget>
      </CreativeMotionProvider>,
    );
    expect(screen.getByText('Poster').getAttribute('data-creative-motion-mode')).toBe('fallback');

    rerender(
      <CreativeMotionProvider viewport="phone">
        <CreativeMotionTarget config={{ id: 'metric-count-up', to: 128 }}>
          0
        </CreativeMotionTarget>
      </CreativeMotionProvider>,
    );
    expect(screen.getByText('128').getAttribute('data-creative-motion-mode')).toBe('runtime');
  });

  it('global pause prevents work while retaining content', () => {
    render(
      <CreativeMotionProvider paused>
        <CreativeMotionTarget config={{ id: 'track-marquee' }}>
          <span>One</span><span>Two</span>
        </CreativeMotionTarget>
      </CreativeMotionProvider>,
    );
    expect(screen.getByText('One').isConnected).toBe(true);
    expect(screen.getByText('One').parentElement?.getAttribute('data-creative-motion-paused'))
      .toBe('true');
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it('commits routes synchronously before starting an optional transition', () => {
    const order: string[] = [];
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => {
        order.push('transition');
        update();
        return {} as ViewTransition;
      },
    });
    function RouteProbe() {
      const transition = useRouteCrossfade({ id: 'route-crossfade' });
      return (
        <button type="button" onClick={() => transition(() => order.push('commit'))}>
          Navigate
        </button>
      );
    }
    render(
      <CreativeMotionProvider>
        <RouteProbe />
      </CreativeMotionProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(order).toEqual(['commit', 'transition']);
  });
});
