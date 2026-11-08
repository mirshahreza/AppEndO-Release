import {
  resolveUiChartNumericValue,
  resolveUiChartPaletteColor,
  type UiChartDataRow,
  type UiChartPaletteId,
} from '../uiChartModel';

export type HierarchyNode = {
  name: string;
  value?: number;
  itemStyle?: { color?: string };
  children?: HierarchyNode[];
  row?: UiChartDataRow;
};

export const buildHierarchy = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
  colorKey: string | undefined,
  seriesColors: Record<string, string> | undefined,
  palette?: UiChartPaletteId,
): HierarchyNode[] => {
  const hasChildren = data.some((row) => typeof row.parent === 'string' && String(row.parent).length > 0);
  if (!hasChildren) {
    return data.map((row, index) => ({
      name: String(row[xAxisKey] ?? row.label ?? `Item ${index + 1}`),
      value: resolveUiChartNumericValue(row, valueKey),
      itemStyle: {
        color: typeof row.color === 'string'
          ? row.color
          : (colorKey ? String(row[colorKey] ?? '') : resolveUiChartPaletteColor(valueKey, index, seriesColors, palette)),
      },
      row,
    }));
  }

  const byId = new Map<string, HierarchyNode & { id: string; parentId?: string }>();
  for (const [index, row] of data.entries()) {
    const id = String(row.id ?? row[xAxisKey] ?? index);
    byId.set(id, {
      id,
      parentId: typeof row.parent === 'string' ? row.parent : undefined,
      name: String(row[xAxisKey] ?? row.label ?? id),
      value: resolveUiChartNumericValue(row, valueKey),
      itemStyle: {
        color: typeof row.color === 'string'
          ? row.color
          : resolveUiChartPaletteColor(valueKey, index, seriesColors, palette),
      },
      row,
      children: [],
    });
  }
  const roots: HierarchyNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
};

export type WaterfallBar = {
  name: string;
  base: number;
  rise: number;
  delta: number;
  fill: string;
  row: UiChartDataRow;
};

export const buildWaterfallBars = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
): WaterfallBar[] => {
  let running = 0;
  return data.map((row, index) => {
    const delta = resolveUiChartNumericValue(row, valueKey);
    const isTotal = String(row.kind ?? '').toLowerCase() === 'total'
      || (index === data.length - 1 && String(row[xAxisKey] ?? '').toLowerCase() === 'total');
    const base = isTotal ? 0 : Math.min(running, running + delta);
    const rise = Math.abs(delta);
    const fill = isTotal ? '#6366f1' : delta >= 0 ? '#10b981' : '#ef4444';
    if (!isTotal) {
      running += delta;
    } else {
      running = delta;
    }
    return {
      name: String(row[xAxisKey] ?? row.label ?? `Step ${index + 1}`),
      base,
      rise,
      delta,
      fill,
      row,
    };
  });
};

export type BoxStats = {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  row: UiChartDataRow;
};

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) {
    return 0;
  }
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) {
    return sorted[base] ?? 0;
  }
  return (sorted[base] ?? 0) + rest * (next - (sorted[base] ?? 0));
};

export const buildBoxStats = (
  data: UiChartDataRow[],
  groupKey: string,
  valueKey: string,
): BoxStats[] => {
  const groups = new Map<string, number[]>();
  for (const row of data) {
    const group = String(row[groupKey] ?? row.label ?? 'Group');
    const list = groups.get(group) ?? [];
    list.push(resolveUiChartNumericValue(row, valueKey));
    groups.set(group, list);
  }
  return Array.from(groups.entries()).map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      name,
      min: sorted[0] ?? 0,
      q1: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      q3: quantile(sorted, 0.75),
      max: sorted[sorted.length - 1] ?? 0,
      row: { label: name, value: quantile(sorted, 0.5) },
    };
  });
};

export type SankeyGraph = {
  nodes: Array<{ name: string }>;
  links: Array<{ source: string; target: string; value: number; row: UiChartDataRow }>;
};

export const buildSankeyGraph = (data: UiChartDataRow[]): SankeyGraph => {
  if (data.length > 0 && typeof data[0].source === 'string' && typeof data[0].target === 'string') {
    const nodeNames = new Set<string>();
    const links = data.map((row) => {
      const source = String(row.source);
      const target = String(row.target);
      nodeNames.add(source);
      nodeNames.add(target);
      return {
        source,
        target,
        value: resolveUiChartNumericValue(row, 'value'),
        row,
      };
    });
    return { nodes: Array.from(nodeNames).map((name) => ({ name })), links };
  }

  const nodes = data.map((row, index) => ({
    name: String(row.label ?? row.name ?? `Node ${index + 1}`),
  }));
  const links: SankeyGraph['links'] = [];
  for (let i = 0; i < data.length - 1; i += 1) {
    links.push({
      source: nodes[i]!.name,
      target: nodes[i + 1]!.name,
      value: resolveUiChartNumericValue(data[i]!, 'value'),
      row: data[i]!,
    });
  }
  return { nodes, links };
};

export const linearTrendline = (
  points: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> | null => {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    return null;
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const xs = points.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ];
};
