import { describe, expect, it } from 'vitest';
import { buildExplainPlanCostSlices, buildExplainPlanFlowGraph, formatDataSourceExplainPlan } from '../formatDataSourceExplainPlan';

describe('formatDataSourceExplainPlan', () => {
  it('returns null for ordinary query rows', () => {
    expect(formatDataSourceExplainPlan([{ id: 1, email: 'a@b.test' }])).toBeNull();
  });

  it('keeps PostgreSQL QUERY PLAN lines as an indented list', () => {
    const items = formatDataSourceExplainPlan([
      { 'QUERY PLAN': 'Seq Scan on users  (cost=0.00..1.05 rows=5 width=32)' },
      { 'QUERY PLAN': '  Filter: (status = \'active\'::text)' },
    ]);
    expect(items?.[0]).toMatchObject({
      depth: 0,
      title: 'Seq Scan on users  (cost=0.00..1.05 rows=5 width=32)',
      cost: 1.05,
      selfCost: 1.05,
    });
    expect(items?.[1]).toMatchObject({
      depth: 1,
      title: 'Filter: (status = \'active\'::text)',
    });
  });

  it('turns SQL Server SHOWPLAN_ALL into operator descriptions', () => {
    const items = formatDataSourceExplainPlan([
      {
        NodeId: 1,
        Parent: 0,
        PhysicalOp: null,
        Type: 'SELECT',
        StmtText: 'SELECT TOP (100) * FROM [Users]',
        EstimateRows: 100,
        TotalSubtreeCost: 0.0032831,
      },
      {
        NodeId: 2,
        Parent: 1,
        PhysicalOp: 'Clustered Index Scan',
        LogicalOp: 'Clustered Index Scan',
        Argument: 'OBJECT:([AppEnd].[dbo].[Users])',
        Type: 'PLAN_ROW',
        StmtText: '  |--Clustered Index Scan(OBJECT:([AppEnd].[dbo].[Users]))',
        EstimateRows: 100,
        TotalSubtreeCost: 0.0032831,
      },
    ]);
    expect(items?.[0]).toMatchObject({
      depth: 0,
      title: 'SELECT  (cost 0.003283, rows 100)',
      detail: 'SELECT TOP (100) * FROM [Users]',
    });
    expect(items?.[1]).toMatchObject({
      depth: 1,
      title: 'Clustered Index Scan on dbo.Users  (cost 0.003283, rows 100)',
      chartLabel: 'Clustered Index Scan',
      selfCost: 0.0032831,
    });
    expect(buildExplainPlanCostSlices(items ?? [])).toEqual([
      { label: 'Clustered Index Scan', value: 0.0032831 },
    ]);
    const graph = buildExplainPlanFlowGraph(items ?? []);
    expect(graph.nodes.map((node) => node.label)).toEqual(['SELECT', 'Clustered Index Scan']);
    expect(graph.edges).toEqual([{ id: 'e-op-0-op-1', source: 'op-0', target: 'op-1' }]);
    expect(graph.nodes[1]?.kind).toBe('scan');
    expect(graph.nodes[1]?.costPercent).toBeGreaterThan(99);
  });
});
