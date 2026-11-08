/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasParticleSystemConfig } from '..';

const runtime = vi.hoisted(() => {
  const mount = {
    setPaused: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    loader: vi.fn(async () => ({ mountVisualEngine: vi.fn(() => mount) })),
    mount,
  };
});

vi.mock('../lazyRegistry', async () => {
  const actual = await vi.importActual<typeof import('../lazyRegistry')>('../lazyRegistry');
  return { ...actual, loadVisualEngineRuntime: runtime.loader };
});

import { CreativeSceneHost, resetCreativeSceneContextLossesForTests } from '..';

const config: CanvasParticleSystemConfig = {
  engineId: 'canvas-particle-system',
  seed: 11,
  particleCount: 20,
  linkCount: 8,
  radius: 2,
  speed: 0.5,
  color: '#2563eb',
  background: '#ffffff',
};

describe('CreativeSceneHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    runtime.loader.mockReset();
    runtime.loader.mockImplementation(async () => ({
      mountVisualEngine: vi.fn(() => runtime.mount),
    }));
    runtime.mount.setPaused.mockClear();
    runtime.mount.resize.mockClear();
    runtime.mount.dispose.mockClear();
    resetCreativeSceneContextLossesForTests();
  });

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads only after capability gates and keeps one decorative canvas', async () => {
    const { container } = render(
      <CreativeSceneHost
        scenes={[config]}
        capabilityOverride={{ snapshot: false, webgl2: true, reducedMotion: false }}
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(runtime.loader).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('canvas')?.getAttribute('style')).toContain('pointer-events: none');
    expect(container.querySelector('canvas')?.textContent).toBe('');
    expect(
      container.querySelector('[data-creative-scene-host]')?.getAttribute('data-runtime-ready'),
    ).toBe('true');
  });

  it('keeps the static fallback when WebGL or Canvas context creation fails', async () => {
    runtime.loader.mockResolvedValueOnce({
      mountVisualEngine: vi.fn(() => null),
    });
    const { container } = render(
      <CreativeSceneHost
        scenes={[config]}
        capabilityOverride={{ snapshot: false, webgl2: true, reducedMotion: false }}
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      container.querySelector('[data-creative-scene-host]')?.getAttribute('data-fallback-reason'),
    ).toBe('webgl-unavailable');
    expect(container.querySelector('[data-visual-engine-fallback]')).not.toBeNull();
    expect(container.querySelector('canvas')?.hasAttribute('hidden')).toBe(true);
  });

  it('does not load offscreen work and pauses immediately when the document becomes hidden', async () => {
    class HiddenIntersectionObserver {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback([{ isIntersecting: false, target } as IntersectionObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '0px';
      thresholds = [0];
    }
    vi.stubGlobal('IntersectionObserver', HiddenIntersectionObserver);
    const offscreen = render(
      <CreativeSceneHost
        scenes={[config]}
        capabilityOverride={{ snapshot: false, webgl2: true, reducedMotion: false }}
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(runtime.loader).not.toHaveBeenCalled();
    expect(
      offscreen.container.querySelector('[data-creative-scene-host]')?.getAttribute('data-fallback-reason'),
    ).toBe('offscreen');
    offscreen.unmount();
    vi.unstubAllGlobals();

    const visible = render(
      <CreativeSceneHost
        scenes={[config]}
        capabilityOverride={{ snapshot: false, webgl2: true, reducedMotion: false }}
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(runtime.mount.dispose).toHaveBeenCalled();
    expect(
      visible.container.querySelector('[data-creative-scene-host]')?.getAttribute('data-fallback-reason'),
    ).toBe('hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('falls back for the session after two context losses', async () => {
    const { container } = render(
      <CreativeSceneHost
        scenes={[config]}
        capabilityOverride={{ snapshot: false, webgl2: true, reducedMotion: false }}
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    act(() => {
      fireEvent(canvas!, new Event('webglcontextlost', { cancelable: true }));
      fireEvent(canvas!, new Event('webglcontextlost', { cancelable: true }));
    });
    expect(
      container.querySelector('[data-creative-scene-host]')?.getAttribute('data-fallback-reason'),
    ).toBe('context-lost');
    expect(container.querySelector('[data-visual-engine-fallback]')).not.toBeNull();
    expect(runtime.mount.dispose).toHaveBeenCalled();
  });
});
