import { describe, expect, it } from 'vitest';
import { allowedSelectorTypesForSource, generateEdgeKey } from '../edgeSelectorRules';
import { buildDefaultNode } from '../nodeTemplates';

describe('allowedSelectorTypesForSource (toolbox edge popover)', () => {
  it('offers UNCONDITIONAL + ON_ERROR from LOOP, matching ACTION/FOR_EACH', () => {
    expect(allowedSelectorTypesForSource(buildDefaultNode('LOOP', 'l1'))).toEqual(['UNCONDITIONAL', 'ON_ERROR']);
    expect(allowedSelectorTypesForSource(buildDefaultNode('ACTION', 'a1'))).toEqual(['UNCONDITIONAL', 'ON_ERROR']);
    expect(allowedSelectorTypesForSource(buildDefaultNode('FOR_EACH', 'f1'))).toEqual(['UNCONDITIONAL', 'ON_ERROR']);
  });

  it('offers DECISION + DECISION_DEFAULT from a MULTI_MATCH decision (inclusive gateway still uses those selectors)', () => {
    const node = { ...buildDefaultNode('DECISION', 'd1'), mode: 'MULTI_MATCH' as const };
    expect(allowedSelectorTypesForSource(node)).toEqual(['DECISION', 'DECISION_DEFAULT']);
  });

  it('offers only UNCONDITIONAL from a plain SUBFLOW (no cancelEvent configured)', () => {
    expect(allowedSelectorTypesForSource(buildDefaultNode('SUBFLOW', 's1'))).toEqual(['UNCONDITIONAL']);
  });

  it('p-99/WFT-9 — additionally offers CANCEL_REGION once a SUBFLOW declares cancelEvent', () => {
    const node = { ...buildDefaultNode('SUBFLOW', 's1'), cancelEvent: { eventName: 'order.cancelled', correlation: { op: 'LITERAL', value: 'x' } } };
    expect(allowedSelectorTypesForSource(node)).toEqual(['UNCONDITIONAL', 'CANCEL_REGION']);
  });

  it('generateEdgeKey appends a suffix when the natural key already exists', () => {
    expect(generateEdgeKey('a', 'b', [])).toBe('a-to-b');
    expect(generateEdgeKey('a', 'b', ['a-to-b'])).toBe('a-to-b-1');
  });
});
