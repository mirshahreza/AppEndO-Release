import { describe, expect, it } from 'vitest';
import type { OrgChartTreeNode } from '../../types';
import {
  isOrgChartSiblingOverflowNodeId,
  limitOrgChartSiblingFanout,
  ORG_CHART_MAX_SIBLINGS_PER_PARENT,
  orgChartOverflowParentId,
} from '../orgChartSiblingLimit';

const n = (id: string, children?: OrgChartTreeNode[]): OrgChartTreeNode => ({
  id,
  label: id,
  children,
});

describe('orgChartSiblingLimit', () => {
  it('caps fan-out and adds an overflow card', () => {
    const children = Array.from({ length: 50 }, (_, index) => n(`c-${index}`));
    const root = n('root', children);
    const limited = limitOrgChartSiblingFanout(root, {
      maxSiblings: 10,
      expandedParentIds: new Set(),
      pinnedNodeIds: new Set(),
    });
    expect(limited.children?.length).toBe(10);
    const last = limited.children?.[limited.children.length - 1];
    expect(last?.label).toMatch(/^\+/);
    expect(isOrgChartSiblingOverflowNodeId(last?.id ?? '')).toBe(true);
    expect(orgChartOverflowParentId(last!.id)).toBe('root');
  });

  it('shows all siblings when parent is expanded', () => {
    const children = Array.from({ length: 50 }, (_, index) => n(`c-${index}`));
    const root = n('root', children);
    const limited = limitOrgChartSiblingFanout(root, {
      maxSiblings: ORG_CHART_MAX_SIBLINGS_PER_PARENT,
      expandedParentIds: new Set(['root']),
      pinnedNodeIds: new Set(),
    });
    expect(limited.children?.length).toBe(50);
  });
});
