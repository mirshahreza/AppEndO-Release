import { describe, expect, it } from 'vitest';
import {
  clampAppendooPlaygroundPoint,
  shiftAppendooPlaygroundPoint,
} from '../useAppendooPlaygroundDrag';

describe('useAppendooPlaygroundDrag', () => {
  it('keeps the companion inside the 0–100 playground', () => {
    expect(clampAppendooPlaygroundPoint(-12, 140)).toEqual({ x: 0, y: 100 });
    expect(clampAppendooPlaygroundPoint(48, 22)).toEqual({ x: 48, y: 22 });
  });

  it('maps pixel travel onto the board as percents', () => {
    expect(shiftAppendooPlaygroundPoint({ x: 50, y: 50 }, 40, -20, { width: 200, height: 100 })).toEqual({
      x: 70,
      y: 30,
    });
    expect(shiftAppendooPlaygroundPoint({ x: 90, y: 10 }, 80, -40, { width: 200, height: 100 })).toEqual({
      x: 100,
      y: 0,
    });
  });
});
