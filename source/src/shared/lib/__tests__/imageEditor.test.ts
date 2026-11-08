import { describe, expect, it } from 'vitest';
import { clampCropRect, isBase64DataUrl, scaleCropRect } from '../imageEditor';

describe('imageEditor', () => {
  it('clamps crop rect inside canvas bounds', () => {
    expect(clampCropRect({ x: -10, y: -5, width: 200, height: 150 }, 100, 80)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
  });

  it('scales crop rect by factor', () => {
    expect(scaleCropRect({ x: 10, y: 20, width: 100, height: 50 }, 2)).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 100,
    });
  });

  it('detects base64 data URLs', () => {
    expect(isBase64DataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isBase64DataUrl('blob:http://localhost/abc')).toBe(false);
    expect(isBase64DataUrl('https://example.com/photo.jpg')).toBe(false);
  });
});
