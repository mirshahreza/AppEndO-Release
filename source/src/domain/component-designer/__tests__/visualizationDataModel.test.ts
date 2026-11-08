import { describe, expect, it } from 'vitest';
import {
  parseDesignerChartData,
  parseDesignerKanbanBoard,
  parseDesignerTimelineEvents,
  parseDesignerTreeNodes,
  parseSeriesKeys,
} from '../visualizationDataModel';
import { MOCK_CHART_SALES_Q1, MOCK_ORG_TREE } from '../visualizationMockFixtures';

describe('visualization data model (CD-O01)', () => {
  it('parses chart series rows with label and numeric keys', () => {
    const rows = parseDesignerChartData(MOCK_CHART_SALES_Q1);
    expect(rows).toHaveLength(6);
    expect(rows[0]?.label).toBe('Jan');
    expect(rows[0]?.revenue).toBe(4200);
  });

  it('parses tree nodes with id, label, children', () => {
    const nodes = parseDesignerTreeNodes(MOCK_ORG_TREE);
    expect(nodes[0]?.id).toBe('org-root');
    expect(nodes[0]?.children?.[0]?.label).toBe('Sales');
  });

  it('parses timeline events with start, end, title', () => {
    const events = parseDesignerTimelineEvents([
      { title: 'Kickoff', start: '2026-01-01', end: '2026-01-02' },
    ]);
    expect(events[0]?.title).toBe('Kickoff');
    expect(events[0]?.start).toBe('2026-01-01');
  });

  it('parses kanban board columns and cards', () => {
    const board = parseDesignerKanbanBoard({
      columns: [{ id: 'todo', title: 'To Do', cards: [{ id: 'c1', title: 'Task' }] }],
    });
    expect(board.columns[0]?.cards[0]?.title).toBe('Task');
  });

  it('parses comma-separated series keys', () => {
    expect(parseSeriesKeys('revenue,cost')).toEqual(['revenue', 'cost']);
  });
});
