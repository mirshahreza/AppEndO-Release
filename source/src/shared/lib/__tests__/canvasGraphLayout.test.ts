import { describe, expect, it } from 'vitest';
import { computeCanvasGraphLayout } from '../canvasGraphLayout';

describe('computeCanvasGraphLayout', () => {
  it('lays out nodes horizontally with dagre LR', () => {
    const positions = computeCanvasGraphLayout(
      'horizontal',
      [
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
      ],
      [{ source: 'a', target: 'b' }],
      'a',
    );
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
  });

  it('lays out nodes vertically with dagre TB', () => {
    const positions = computeCanvasGraphLayout(
      'vertical',
      [
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
      ],
      [{ source: 'a', target: 'b' }],
      'a',
    );
    expect(positions.get('a')!.y).toBeLessThan(positions.get('b')!.y);
  });
});
