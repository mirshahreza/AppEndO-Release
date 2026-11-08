import { describe, expect, it } from 'vitest';
import {
  canvasLineDashForStyle,
  clampPointToNatural,
  displayPointToNatural,
  normalizeDragRect,
  svgStrokeDasharray,
} from '../imageEditorAnnotations';

const metrics = {
  naturalWidth: 1000,
  naturalHeight: 500,
  displayWidth: 500,
  displayHeight: 250,
  offsetX: 50,
  offsetY: 25,
  scale: 0.5,
};

describe('imageEditorAnnotations', () => {
  it('maps display coordinates to natural image space', () => {
    expect(displayPointToNatural(50, 25, metrics)).toEqual({ x: 0, y: 0 });
    expect(displayPointToNatural(550, 275, metrics)).toEqual({ x: 1000, y: 500 });
  });

  it('clamps natural points inside canvas bounds', () => {
    expect(clampPointToNatural({ x: -10, y: 600 }, 1000, 500)).toEqual({ x: 0, y: 500 });
  });

  it('normalizes drag rectangles regardless of direction', () => {
    expect(normalizeDragRect({ x: 80, y: 20 }, { x: 20, y: 60 })).toEqual({
      x: 20,
      y: 20,
      width: 60,
      height: 40,
    });
  });

  it('maps line styles to canvas and svg dash patterns', () => {
    expect(canvasLineDashForStyle('solid', 4)).toEqual([]);
    expect(canvasLineDashForStyle('dashed', 4)).toEqual([16, 10]);
    expect(svgStrokeDasharray('dotted', 4)).toBe('4 4');
  });
});
