import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  pickClosestNodeSides,
  pointOnNodeSide,
  resolveSchemaRelationEdgeEndpoints,
} from '../schemaRelationEdgeGeometry';

const box = (x: number, y: number, width = 200, height = 80) => ({ x, y, width, height });

describe('schemaRelationEdgeGeometry', () => {
  it('connects vertically when target is below source', () => {
    const sides = pickClosestNodeSides(box(0, 0), box(0, 200));
    expect(sides).toEqual({
      sourceSide: Position.Bottom,
      targetSide: Position.Top,
    });
  });

  it('connects horizontally when target is to the right', () => {
    const sides = pickClosestNodeSides(box(0, 0), box(300, 0));
    expect(sides).toEqual({
      sourceSide: Position.Right,
      targetSide: Position.Left,
    });
  });

  it('anchors on the center of the chosen side', () => {
    const source = box(10, 20, 100, 40);
    const point = pointOnNodeSide(source, Position.Bottom);
    expect(point).toEqual({ x: 60, y: 60 });
  });

  it('resolves endpoints from internal nodes', () => {
    const endpoints = resolveSchemaRelationEdgeEndpoints(
      {
        measured: { width: 200, height: 80 },
        width: 200,
        height: 80,
        internals: { positionAbsolute: { x: 0, y: 0 } },
      } as never,
      {
        measured: { width: 200, height: 80 },
        width: 200,
        height: 80,
        internals: { positionAbsolute: { x: 0, y: 160 } },
      } as never,
    );
    expect(endpoints?.sourcePosition).toBe(Position.Bottom);
    expect(endpoints?.targetPosition).toBe(Position.Top);
    expect(endpoints!.sourceY).toBe(80);
    expect(endpoints!.targetY).toBe(160);
  });

  it('fans parallel lanes along the node sides', () => {
    const source = {
      measured: { width: 200, height: 200 },
      width: 200,
      height: 200,
      internals: { positionAbsolute: { x: 0, y: 0 } },
    } as never;
    const target = {
      measured: { width: 200, height: 200 },
      width: 200,
      height: 200,
      internals: { positionAbsolute: { x: 400, y: 0 } },
    } as never;
    const first = resolveSchemaRelationEdgeEndpoints(source, target, 0, 3, { useSideLanes: true });
    const last = resolveSchemaRelationEdgeEndpoints(source, target, 2, 3, { useSideLanes: true });
    expect(first!.sourceY).toBeLessThan(last!.sourceY);
    expect(first!.targetY).toBeLessThan(last!.targetY);
  });
});
