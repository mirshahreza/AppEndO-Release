import { describe, expect, it } from 'vitest';
import type { WorkflowModel } from '../../types';
import {
  WORKFLOW_GRAPH_LAYOUT_OPTIONS,
  computeWorkflowGraphLayout,
  orderWorkflowNodesForLayout,
} from '../computeWorkflowGraphLayout';

function buildModel(overrides?: Partial<WorkflowModel>): WorkflowModel {
  return {
    schemaVersion: '1',
    key: 'sample',
    name: 'sample',
    start: { type: 'MANUAL_API', targetNodeKey: 'start' },
    nodes: [
      { key: 'start', kind: 'ACTION' },
      { key: 'mid', kind: 'ACTION' },
      { key: 'end', kind: 'END' },
    ],
    edges: [
      { key: 'e1', fromNodeKey: 'start', toNodeKey: 'mid', selector: { type: 'ALWAYS' } },
      { key: 'e2', fromNodeKey: 'mid', toNodeKey: 'end', selector: { type: 'ALWAYS' } },
    ],
    variables: [],
    policies: {},
    inputSchema: {},
    outputSchema: {},
    ...overrides,
  };
}

describe('computeWorkflowGraphLayout', () => {
  it('exposes the four designer layout modes', () => {
    expect(WORKFLOW_GRAPH_LAYOUT_OPTIONS.map((option) => option.value)).toEqual([
      'horizontal',
      'vertical',
      'triangle',
      'radial',
    ]);
  });

  it('orders nodes breadth-first from the start target', () => {
    expect(orderWorkflowNodesForLayout(buildModel())).toEqual(['start', 'mid', 'end']);
  });

  it('places horizontal layouts left-to-right by flow', () => {
    const positions = computeWorkflowGraphLayout(buildModel(), 'horizontal');
    expect(positions.start!.x).toBeLessThan(positions.mid!.x);
    expect(positions.mid!.x).toBeLessThan(positions.end!.x);
  });

  it('places vertical layouts top-to-bottom by flow', () => {
    const positions = computeWorkflowGraphLayout(buildModel(), 'vertical');
    expect(positions.start!.y).toBeLessThan(positions.mid!.y);
    expect(positions.mid!.y).toBeLessThan(positions.end!.y);
  });

  it('places radial layouts around a shared center', () => {
    const positions = computeWorkflowGraphLayout(buildModel(), 'radial');
    const keys = Object.keys(positions);
    expect(keys).toHaveLength(3);

    const centers = keys.map((key) => ({
      x: positions[key]!.x + 80,
      y: positions[key]!.y + 28,
    }));
    const meanX = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
    const meanY = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
    const radii = centers.map((point) => Math.hypot(point.x - meanX, point.y - meanY));
    const max = Math.max(...radii);
    const min = Math.min(...radii);
    expect(max - min).toBeLessThan(1);
  });

  it('places triangle layouts on three distinct sides', () => {
    const model = buildModel({
      nodes: [
        { key: 'a', kind: 'ACTION' },
        { key: 'b', kind: 'ACTION' },
        { key: 'c', kind: 'ACTION' },
        { key: 'd', kind: 'ACTION' },
        { key: 'e', kind: 'ACTION' },
        { key: 'f', kind: 'ACTION' },
      ],
      edges: [],
      start: { type: 'MANUAL_API', targetNodeKey: 'a' },
    });
    const positions = computeWorkflowGraphLayout(model, 'triangle');
    const ys = Object.values(positions).map((position) => position.y);
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys));
    expect(Object.keys(positions)).toHaveLength(6);
  });
});
