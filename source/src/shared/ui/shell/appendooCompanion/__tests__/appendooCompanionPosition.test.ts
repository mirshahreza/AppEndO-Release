import { describe, expect, it } from 'vitest';
import { resolveCompanionFace } from '../resolveCompanionFace';
import {
  clampCompanionPosition,
  resolveCompanionHomePosition,
  resolveTuckSideFromDrop,
  tuckedCompanionPosition,
} from '../appendooCompanionPosition';

describe('resolveCompanionFace', () => {
  const idle = {
    dragged: false,
    hovered: false,
    sleepy: false,
    surprised: false,
    near: false,
    override: null,
  };

  it('prefers grabbed while dragging', () => {
    expect(resolveCompanionFace({
      ...idle,
      dragged: true,
      override: 'celebrate',
      hovered: true,
    })).toBe('grabbed');
  });

  it('uses a mood override before idle reactions', () => {
    expect(resolveCompanionFace({ ...idle, override: 'thinking', near: true })).toBe('thinking');
  });

  it('falls through sleepy, surprised, happy, then curious', () => {
    expect(resolveCompanionFace({ ...idle, sleepy: true })).toBe('sleepy');
    expect(resolveCompanionFace({ ...idle, surprised: true })).toBe('surprised');
    expect(resolveCompanionFace({ ...idle, hovered: true })).toBe('happy');
    expect(resolveCompanionFace({ ...idle, near: true })).toBe('curious');
    expect(resolveCompanionFace(idle)).toBe('idle');
  });
});

describe('appendooCompanionPosition', () => {
  it('homes to the bottom-end corner', () => {
    expect(resolveCompanionHomePosition(1280, 800, 64, false)).toEqual({ x: 1192, y: 648 });
    expect(resolveCompanionHomePosition(1280, 800, 64, true)).toEqual({ x: 24, y: 648 });
  });

  it('clamps inside the viewport margin', () => {
    expect(clampCompanionPosition({ x: -40, y: 9000 }, 1280, 800, 64)).toEqual({ x: 12, y: 724 });
  });

  it('tucks only when dropped against an edge, not at the default home', () => {
    const home = resolveCompanionHomePosition(1280, 800, 64, false);
    expect(resolveTuckSideFromDrop(home.x, 1280, 64)).toBeNull();
    expect(resolveTuckSideFromDrop(12, 1280, 64)).toBe('left');
    expect(resolveTuckSideFromDrop(1280 - 64 - 12, 1280, 64)).toBe('right');
  });

  it('parks a tucked companion as an edge sliver', () => {
    expect(tuckedCompanionPosition('right', 400, 1280, 800, 64)).toMatchObject({
      x: 1258,
      tucked: 'right',
    });
  });
});
