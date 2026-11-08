import dagre from '@dagrejs/dagre';

export type ExplainPlanListItem = {
  depth: number;
  title: string;
  detail?: string;
  chartLabel?: string;
  cost?: number;
  selfCost?: number;
};

export type ExplainPlanCostSlice = {
  label: string;
  value: number;
};

export type ExplainPlanOperatorKind =
  | 'statement'
  | 'join'
  | 'scan'
  | 'seek'
  | 'compute'
  | 'filter'
  | 'sort'
  | 'spool'
  | 'concat'
  | 'other';

export type ExplainPlanFlowNodeModel = {
  id: string;
  label: string;
  detail?: string;
  costPercent: number;
  kind: ExplainPlanOperatorKind;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  position: { x: number; y: number };
};

export type ExplainPlanFlowEdgeModel = {
  id: string;
  source: string;
  target: string;
};

export const EXPLAIN_PLAN_FLOW_NODE_WIDTH = 168;
export const EXPLAIN_PLAN_FLOW_NODE_HEIGHT = 56;

const COST_SLICE_LIMIT = 8;

const fieldValueRaw = (row: Record<string, unknown>, ...names: string[]): string => {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lookup.get(name.toLowerCase());
    if (value == null) {
      continue;
    }
    const text = String(value);
    if (text.trim().length > 0 && text.trim().toLowerCase() !== 'null') {
      return text;
    }
  }
  return '';
};

const fieldValue = (row: Record<string, unknown>, ...names: string[]): string => (
  fieldValueRaw(row, ...names).trim()
);

const fieldKeys = (row: Record<string, unknown>): string[] => (
  Object.keys(row).map((key) => key.toLowerCase())
);

const compactNumber = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  if (Number.isInteger(numeric) || Math.abs(numeric) >= 10) {
    return String(Math.round(numeric * 100) / 100);
  }
  return numeric.toPrecision(4).replace(/\.?0+$/, '');
};

const parseExplainCost = (text: string): number | undefined => {
  const postgres = text.match(/\bcost\s*=\s*[-\d.]+\.\.([-\d.]+)/i);
  if (postgres) {
    const value = Number(postgres[1]);
    return Number.isFinite(value) ? value : undefined;
  }
  const labeled = text.match(/\bcost\s+([-\d.]+)\b/i);
  if (labeled) {
    const value = Number(labeled[1]);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
};

const toFiniteNumber = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const shortenChartLabel = (item: ExplainPlanListItem): string => {
  if (item.chartLabel?.trim()) {
    return item.chartLabel.trim();
  }
  return item.title.replace(/\s+\(.*\)$/, '').trim().slice(0, 48) || item.title;
};

const uniqueSliceLabel = (label: string, used: Map<string, number>): string => {
  const count = used.get(label) ?? 0;
  used.set(label, count + 1);
  return count === 0 ? label : `${label} (${count + 1})`;
};

const attachExplainPlanSelfCosts = (items: ExplainPlanListItem[]): ExplainPlanListItem[] => {
  const withCost = items.map((item) => ({
    ...item,
    cost: item.cost ?? parseExplainCost(item.title),
  }));

  return withCost.map((item, index) => {
    if (item.cost == null) {
      return item;
    }
    let childSum = 0;
    for (let next = index + 1; next < withCost.length; next += 1) {
      const child = withCost[next];
      if (child.depth <= item.depth) {
        break;
      }
      if (child.depth === item.depth + 1) {
        childSum += child.cost ?? 0;
      }
    }
    return {
      ...item,
      selfCost: Math.max(0, item.cost - childSum),
    };
  });
};

/** Self-cost slices for a pie/donut — each operator's share of the plan, no double-counting. */
export const buildExplainPlanCostSlices = (items: ExplainPlanListItem[]): ExplainPlanCostSlice[] => {
  const usedLabels = new Map<string, number>();
  const fromSelf = items
    .filter((item) => (item.selfCost ?? 0) > 1e-12)
    .map((item) => ({
      label: uniqueSliceLabel(shortenChartLabel(item), usedLabels),
      value: item.selfCost as number,
    }))
    .sort((left, right) => right.value - left.value);

  const source = fromSelf.length > 0
    ? fromSelf
    : items
      .filter((item) => item.depth === 1 && (item.cost ?? 0) > 1e-12)
      .map((item) => ({
        label: uniqueSliceLabel(shortenChartLabel(item), usedLabels),
        value: item.cost as number,
      }))
      .sort((left, right) => right.value - left.value);

  if (source.length <= COST_SLICE_LIMIT) {
    return source;
  }

  const head = source.slice(0, COST_SLICE_LIMIT);
  const rest = source.slice(COST_SLICE_LIMIT).reduce((sum, row) => sum + row.value, 0);
  return rest > 1e-12 ? [...head, { label: 'Other', value: rest }] : head;
};

export const formatExplainPlanCostPercent = (percent: number): string => {
  if (percent >= 10) {
    return `${Math.round(percent)}%`;
  }
  if (percent >= 1) {
    return `${percent.toFixed(1)}%`;
  }
  if (percent > 0) {
    return '<1%';
  }
  return '0%';
};

export const classifyExplainPlanOperator = (label: string): ExplainPlanOperatorKind => {
  const text = label.toLowerCase();
  if (/^(select|insert|update|delete|merge|statement|batch)\b/.test(text)) {
    return 'statement';
  }
  if (/nested loops|hash match|merge join|\bjoin\b|\bapply\b/.test(text)) {
    return 'join';
  }
  if (/\bseek\b/.test(text)) {
    return 'seek';
  }
  if (/\bscan\b/.test(text)) {
    return 'scan';
  }
  if (/\bfilter\b|\bassert\b/.test(text)) {
    return 'filter';
  }
  if (/\bsort\b/.test(text)) {
    return 'sort';
  }
  if (/\bspool\b/.test(text)) {
    return 'spool';
  }
  if (/\bconcat|\bunion\b|\bsequence\b/.test(text)) {
    return 'concat';
  }
  if (/\bcompute\b|\bscalar\b|\bconstant\b/.test(text)) {
    return 'compute';
  }
  return 'other';
};

/** Same dagre LR graph the workflow engine uses — parent left, inputs to the right. */
export const buildExplainPlanFlowGraph = (
  items: ExplainPlanListItem[],
): { nodes: ExplainPlanFlowNodeModel[]; edges: ExplainPlanFlowEdgeModel[] } => {
  if (items.length === 0) {
    return { nodes: [], edges: [] };
  }

  const totalSelf = items.reduce((sum, item) => sum + (item.selfCost ?? 0), 0);
  const total = totalSelf > 1e-12 ? totalSelf : (items[0].cost ?? 0);

  const edges: ExplainPlanFlowEdgeModel[] = [];
  const stack: Array<{ depth: number; id: string }> = [];
  const drafts: Array<Omit<ExplainPlanFlowNodeModel, 'hasIncoming' | 'hasOutgoing' | 'position'>> = [];

  items.forEach((item, index) => {
    const id = `op-${index}`;
    const percent = total > 1e-12 ? ((item.selfCost ?? item.cost ?? 0) / total) * 100 : 0;
    const label = shortenChartLabel(item);
    drafts.push({
      id,
      label,
      detail: item.detail,
      costPercent: percent,
      kind: classifyExplainPlanOperator(label),
    });

    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1].id;
      edges.push({ id: `e-${parentId}-${id}`, source: parentId, target: id });
    }
    stack.push({ depth: item.depth, id });
  });

  const incoming = new Set(edges.map((edge) => edge.target));
  const outgoing = new Set(edges.map((edge) => edge.source));

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 40,
    ranksep: 90,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const draft of drafts) {
    graph.setNode(draft.id, { width: EXPLAIN_PLAN_FLOW_NODE_WIDTH, height: EXPLAIN_PLAN_FLOW_NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);

  const nodes: ExplainPlanFlowNodeModel[] = drafts.map((draft) => {
    const pos = graph.node(draft.id);
    return {
      ...draft,
      hasIncoming: incoming.has(draft.id),
      hasOutgoing: outgoing.has(draft.id),
      position: {
        x: (pos?.x ?? 0) - EXPLAIN_PLAN_FLOW_NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - EXPLAIN_PLAN_FLOW_NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes, edges };
};

const estimateSuffix = (rows: string, cost: string): string => {
  const parts: string[] = [];
  if (cost) {
    parts.push(`cost ${compactNumber(cost)}`);
  }
  if (rows) {
    parts.push(`rows ${compactNumber(rows)}`);
  }
  return parts.length > 0 ? `  (${parts.join(', ')})` : '';
};

const formatShowPlanObject = (argument: string): string => {
  const objectMatch = argument.match(/OBJECT:\(([^)]+)\)/i);
  if (!objectMatch) {
    return argument;
  }
  const dotted = objectMatch[1].replace(/[\[\]]/g, '');
  const parts = dotted.split('.').filter(Boolean);
  const visible = parts.length >= 3 ? parts.slice(1).join('.') : dotted;
  const rest = argument.replace(objectMatch[0], '').replace(/^,?\s*/, '').trim();
  return rest ? `${visible} · ${rest}` : visible;
};

const depthFromLeadingWhitespace = (text: string): number => {
  const match = text.match(/^[ \t]*/);
  return Math.min(8, Math.floor((match?.[0].length ?? 0) / 2));
};

const formatQueryPlanColumn = (
  rows: Record<string, unknown>[],
  column: string,
): ExplainPlanListItem[] => (
  rows
    .map((row) => {
      const text = fieldValueRaw(row, column);
      if (!text.trim()) {
        return null;
      }
      const title = text.trim();
      return {
        depth: depthFromLeadingWhitespace(text),
        title,
        chartLabel: title.replace(/\s+\(.*\)$/, '').trim() || title,
        cost: parseExplainCost(title),
      };
    })
    .filter((item): item is ExplainPlanListItem => item !== null)
);

const formatShowPlanText = (rows: Record<string, unknown>[]): ExplainPlanListItem[] => (
  rows
    .map((row) => {
      const text = fieldValueRaw(row, 'StmtText');
      if (!text.trim()) {
        return null;
      }
      const treeMatch = text.match(/^[\s|\\-]*/);
      const prefix = treeMatch?.[0] ?? '';
      const depth = Math.min(8, Math.floor(prefix.replace(/\|/g, '  ').length / 2));
      return {
        depth,
        title: text.replace(/^[\s|\\-]+/, '').trim() || text.trim(),
      };
    })
    .filter((item): item is ExplainPlanListItem => item !== null)
);

const formatShowPlanAll = (rows: Record<string, unknown>[]): ExplainPlanListItem[] => {
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const nodeId = Number(fieldValue(row, 'NodeId'));
    if (Number.isFinite(nodeId) && nodeId > 0) {
      byId.set(nodeId, row);
    }
  }

  const depthOf = (row: Record<string, unknown>): number => {
    let depth = 0;
    let parent = Number(fieldValue(row, 'Parent'));
    const seen = new Set<number>();
    while (Number.isFinite(parent) && parent > 0 && byId.has(parent) && depth < 16) {
      if (seen.has(parent)) {
        break;
      }
      seen.add(parent);
      depth += 1;
      parent = Number(fieldValue(byId.get(parent) as Record<string, unknown>, 'Parent'));
    }
    return depth;
  };

  return rows.map((row) => {
    const physicalOp = fieldValue(row, 'PhysicalOp');
    const logicalOp = fieldValue(row, 'LogicalOp');
    const argument = formatShowPlanObject(fieldValue(row, 'Argument'));
    const stmtText = fieldValue(row, 'StmtText');
    const type = fieldValue(row, 'Type');
    const suffix = estimateSuffix(fieldValue(row, 'EstimateRows'), fieldValue(row, 'TotalSubtreeCost'));

    const cost = toFiniteNumber(fieldValue(row, 'TotalSubtreeCost'));

    if (!physicalOp) {
      const sql = stmtText.replace(/^[\s|\\-]+/, '').trim();
      return {
        depth: 0,
        title: `${type || 'Statement'}${suffix}`,
        detail: sql && sql !== type ? sql : undefined,
        chartLabel: type || 'Statement',
        cost,
      };
    }

  const joinLabel = logicalOp && logicalOp !== physicalOp ? `${physicalOp} (${logicalOp})` : physicalOp;
    const objectPart = argument ? ` on ${argument}` : '';
    return {
      depth: depthOf(row),
      title: `${joinLabel}${objectPart}${suffix}`,
      chartLabel: joinLabel,
      cost,
    };
  });
};

const formatMysqlExplain = (rows: Record<string, unknown>[]): ExplainPlanListItem[] => (
  rows.map((row, index) => {
    const table = fieldValue(row, 'table');
    const selectType = fieldValue(row, 'select_type');
    const access = fieldValue(row, 'type');
    const extra = fieldValue(row, 'Extra');
    const key = fieldValue(row, 'key');
    const rowCount = fieldValue(row, 'rows');
    const titleParts = [
      selectType || `Step ${index + 1}`,
      table ? `on ${table}` : '',
      access ? `(${access})` : '',
    ].filter(Boolean);
    const detailParts = [
      key ? `key ${key}` : '',
      rowCount ? `rows ${compactNumber(rowCount)}` : '',
      extra,
    ].filter(Boolean);
    return {
      depth: 0,
      title: titleParts.join(' '),
      detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
    };
  })
);

/** Turns EXPLAIN / SHOWPLAN result rows into a readable list, or null when the grid should stay. */
export const formatDataSourceExplainPlan = (
  rows: Record<string, unknown>[],
): ExplainPlanListItem[] | null => {
  if (rows.length === 0) {
    return null;
  }

  const keys = fieldKeys(rows[0]);

  let items: ExplainPlanListItem[] | null = null;

  if (keys.includes('query plan')) {
    const parsed = formatQueryPlanColumn(rows, 'QUERY PLAN');
    items = parsed.length > 0 ? parsed : null;
  } else if (keys.includes('physicalop') || (keys.includes('nodeid') && keys.includes('parent'))) {
    items = formatShowPlanAll(rows);
  } else if (keys.includes('stmttext')) {
    const parsed = formatShowPlanText(rows);
    items = parsed.length > 0 ? parsed : null;
  } else if (keys.includes('select_type') && (keys.includes('extra') || keys.includes('table'))) {
    items = formatMysqlExplain(rows);
  } else if (keys.includes('detail') && (keys.includes('selectid') || keys.includes('order'))) {
    const parsed = formatQueryPlanColumn(rows, 'detail');
    items = parsed.length > 0 ? parsed : null;
  }

  return items ? attachExplainPlanSelfCosts(items) : null;
};
