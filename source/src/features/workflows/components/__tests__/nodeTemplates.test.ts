import { describe, expect, it } from 'vitest';
import { NODE_KINDS, NODE_KIND_LABELS, NODE_KIND_DESCRIPTIONS, buildDefaultNode, generateNodeKey } from '../nodeTemplates';

describe('workflow toolbox node templates', () => {
  it('includes LOOP in the palette kind list with an operator-facing label and description', () => {
    expect(NODE_KINDS).toContain('LOOP');
    expect(NODE_KIND_LABELS.LOOP).toBe('Loop while');
    expect(NODE_KIND_DESCRIPTIONS.LOOP).toMatch(/previous output/i);
    expect(NODE_KIND_DESCRIPTIONS.DECISION).toMatch(/MULTI_MATCH/);
  });

  it('seeds a LOOP default that binds CURRENT_ITEM_INDEX in the while condition', () => {
    const node = buildDefaultNode('LOOP', 'loop-1');
    expect(node.kind).toBe('LOOP');
    expect(node).toMatchObject({
      key: 'loop-1',
      maxIterations: 5,
      actionRef: { action: { actionKey: 'text.template' } },
    });
    expect(node.condition).toMatchObject({
      op: 'LT',
      left: { op: 'PATH', path: { root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] } },
      right: { op: 'LITERAL', value: 3 },
    });
  });

  it('seeds DECISION as EXACT_ONE so MULTI_MATCH is an explicit author choice', () => {
    expect(buildDefaultNode('DECISION', 'd1')).toEqual({ kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' });
  });

  it('generateNodeKey stays unique against existing keys', () => {
    const first = generateNodeKey('LOOP', []);
    const second = generateNodeKey('LOOP', [first]);
    expect(first).not.toBe(second);
    expect(first.startsWith('loop-')).toBe(true);
  });
});
