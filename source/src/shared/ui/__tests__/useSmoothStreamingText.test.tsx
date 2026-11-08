/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { useSmoothStreamingText } from '../useSmoothStreamingText';

const Probe: React.FC<{ target: string; enabled: boolean }> = ({ target, enabled }) => {
  const text = useSmoothStreamingText(target, enabled);
  return <div data-testid="probe">{text}</div>;
};

const probeText = (): string => screen.getByTestId('probe').textContent ?? '';

describe('useSmoothStreamingText', () => {
  let rafQueue: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const flushFrames = (count = 50): void => {
    for (let i = 0; i < count && rafQueue.length > 0; i += 1) {
      const frame = rafQueue.shift()!;
      act(() => frame(performance.now()));
    }
  };

  it('shows initial content immediately on mount (history load)', () => {
    render(<Probe target="a complete historical answer" enabled />);
    expect(probeText()).toBe('a complete historical answer');
  });

  it('reveals appended text progressively across animation frames', () => {
    const { rerender } = render(<Probe target="" enabled />);
    const appended = 'first words arrive then more words follow with additional detail to reveal';
    rerender(<Probe target={appended} enabled />);

    expect(probeText()).toBe('');
    flushFrames(1);
    const afterOneFrame = probeText();
    expect(afterOneFrame.length).toBeGreaterThan(0);
    expect(afterOneFrame.length).toBeLessThan(appended.length);
    expect(appended.startsWith(afterOneFrame)).toBe(true);

    flushFrames();
    expect(probeText()).toBe(appended);
  });

  it('snaps immediately on a non-append change (authoritative final text)', () => {
    const { rerender } = render(<Probe target="streamed narration text" enabled />);
    rerender(<Probe target="completely different final answer" enabled />);
    expect(probeText()).toBe('completely different final answer');
  });

  it('snaps immediately when smoothing is disabled', () => {
    const { rerender } = render(<Probe target="" enabled={false} />);
    rerender(<Probe target="user message content" enabled={false} />);
    expect(probeText()).toBe('user message content');
  });

  it('catches up faster when the backlog is large', () => {
    const { rerender } = render(<Probe target="" enabled />);
    const bigBacklog = 'word '.repeat(400).trim();
    rerender(<Probe target={bigBacklog} enabled />);
    flushFrames(1);
    // Proportional catch-up: a single frame on a ~2000 char backlog reveals far more
    // than the 8-char floor.
    expect(probeText().length).toBeGreaterThan(100);
  });
});
