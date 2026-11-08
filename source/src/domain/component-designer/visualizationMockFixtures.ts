/**
 * CD-O36 — Named visualization mock datasets for designer preview.
 * @see specs/component-designer/04-visualization-data-model.md
 */

import type {
  DesignerChartDataRow,
  DesignerKanbanBoard,
  DesignerSheetData,
  DesignerTimelineEvent,
  DesignerTreeNode,
} from './visualizationDataModel';

const VISUALIZATION_FIXTURE_SETS = [
  { id: 'sales-demo', label: 'Sales demo (default)' },
  { id: 'viz-sales-q1', label: 'Q1 revenue chart' },
  { id: 'viz-org-tree', label: 'Organization tree' },
  { id: 'viz-project-timeline', label: 'Project timeline' },
  { id: 'empty-state', label: 'Empty state' },
  { id: 'large-dataset', label: 'Large dataset' },
] as const;

export type VisualizationFixtureSetId = (typeof VISUALIZATION_FIXTURE_SETS)[number]['id'];

export const MOCK_CHART_SALES_Q1: DesignerChartDataRow[] = [
  { label: 'Jan', revenue: 4200, cost: 2800 },
  { label: 'Feb', revenue: 5100, cost: 3100 },
  { label: 'Mar', revenue: 4800, cost: 2950 },
  { label: 'Apr', revenue: 5600, cost: 3200 },
  { label: 'May', revenue: 6200, cost: 3400 },
  { label: 'Jun', revenue: 5900, cost: 3300 },
];

export const MOCK_CHART_SALES_Q1_JSON = JSON.stringify(MOCK_CHART_SALES_Q1);

/** Phase 52 — sample datasets for advanced statistical charts + maps. */
const MOCK_CHART_SCATTER = [
  { x: 12, y: 40, size: 80, label: 'A' },
  { x: 28, y: 55, size: 120, label: 'B' },
  { x: 45, y: 32, size: 60, label: 'C' },
  { x: 60, y: 70, size: 150, label: 'D' },
  { x: 75, y: 48, size: 90, label: 'E' },
];

const MOCK_CHART_RADAR = [
  { label: 'Quality', alpha: 80, beta: 65 },
  { label: 'Speed', alpha: 70, beta: 85 },
  { label: 'Cost', alpha: 55, beta: 60 },
  { label: 'Support', alpha: 90, beta: 70 },
  { label: 'Reliability', alpha: 75, beta: 88 },
];

const MOCK_CHART_HEATMAP = [
  { x: 'Mon', y: 'Morning', value: 12 },
  { x: 'Mon', y: 'Afternoon', value: 22 },
  { x: 'Tue', y: 'Morning', value: 18 },
  { x: 'Tue', y: 'Afternoon', value: 30 },
  { x: 'Wed', y: 'Morning', value: 9 },
  { x: 'Wed', y: 'Afternoon', value: 25 },
];

const MOCK_CHART_FUNNEL = [
  { label: 'Visitors', value: 1000 },
  { label: 'Leads', value: 420 },
  { label: 'Trials', value: 180 },
  { label: 'Paid', value: 64 },
];

const MOCK_CHART_WATERFALL = [
  { label: 'Start', value: 100, kind: 'total' },
  { label: 'Sales', value: 40 },
  { label: 'Refunds', value: -15 },
  { label: 'Fees', value: -8 },
  { label: 'End', value: 117, kind: 'total' },
];

const MOCK_CHART_TREEMAP = [
  { label: 'Electronics', value: 420 },
  { label: 'Apparel', value: 260 },
  { label: 'Home', value: 180 },
  { label: 'Grocery', value: 140 },
];

const MOCK_CHART_SUNBURST = [
  { id: 'electronics', label: 'Electronics', value: 420 },
  { id: 'phones', label: 'Phones', value: 200, parent: 'electronics' },
  { id: 'laptops', label: 'Laptops', value: 220, parent: 'electronics' },
  { id: 'apparel', label: 'Apparel', value: 260 },
  { id: 'shirts', label: 'Shirts', value: 140, parent: 'apparel' },
  { id: 'shoes', label: 'Shoes', value: 120, parent: 'apparel' },
];

const MOCK_CHART_SANKEY = [
  { source: 'Traffic', target: 'Product', value: 120 },
  { source: 'Traffic', target: 'Blog', value: 80 },
  { source: 'Product', target: 'Checkout', value: 55 },
  { source: 'Blog', target: 'Checkout', value: 20 },
  { source: 'Checkout', target: 'Paid', value: 40 },
];

const MOCK_CHART_CANDLESTICK = [
  { label: 'Mon', open: 100, high: 112, low: 95, close: 108, volume: 1200 },
  { label: 'Tue', open: 108, high: 118, low: 104, close: 110, volume: 980 },
  { label: 'Wed', open: 110, high: 115, low: 98, close: 101, volume: 1400 },
  { label: 'Thu', open: 101, high: 109, low: 99, close: 107, volume: 1100 },
];

const MOCK_CHART_BOXPLOT = [
  { group: 'North', value: 12 },
  { group: 'North', value: 18 },
  { group: 'North', value: 22 },
  { group: 'North', value: 25 },
  { group: 'South', value: 8 },
  { group: 'South', value: 14 },
  { group: 'South', value: 16 },
  { group: 'South', value: 30 },
  { group: 'East', value: 20 },
  { group: 'East', value: 21 },
  { group: 'East', value: 23 },
  { group: 'East', value: 24 },
];

const MOCK_MAP_PINS = [
  { id: 'tehran', lat: 35.6892, lng: 51.389, label: 'Tehran HQ' },
  { id: 'isfahan', lat: 32.6539, lng: 51.666, label: 'Isfahan Store' },
  { id: 'shiraz', lat: 29.5918, lng: 52.5837, label: 'Shiraz Depot' },
];

const MOCK_MAP_CHOROPLETH = [
  { regionCode: 'TEH', value: 120, label: 'Tehran' },
  { regionCode: 'ISF', value: 80, label: 'Isfahan' },
  { regionCode: 'FRS', value: 55, label: 'Fars' },
  { regionCode: 'KHR', value: 95, label: 'Khorasan' },
];

export const MOCK_CHART_SCATTER_JSON = JSON.stringify(MOCK_CHART_SCATTER);
const MOCK_CHART_RADAR_JSON = JSON.stringify(MOCK_CHART_RADAR);
const MOCK_CHART_HEATMAP_JSON = JSON.stringify(MOCK_CHART_HEATMAP);
const MOCK_CHART_FUNNEL_JSON = JSON.stringify(MOCK_CHART_FUNNEL);
const MOCK_CHART_WATERFALL_JSON = JSON.stringify(MOCK_CHART_WATERFALL);
const MOCK_CHART_TREEMAP_JSON = JSON.stringify(MOCK_CHART_TREEMAP);
const MOCK_CHART_SUNBURST_JSON = JSON.stringify(MOCK_CHART_SUNBURST);
const MOCK_CHART_SANKEY_JSON = JSON.stringify(MOCK_CHART_SANKEY);
const MOCK_CHART_CANDLESTICK_JSON = JSON.stringify(MOCK_CHART_CANDLESTICK);
const MOCK_CHART_BOXPLOT_JSON = JSON.stringify(MOCK_CHART_BOXPLOT);
export const MOCK_MAP_PINS_JSON = JSON.stringify(MOCK_MAP_PINS);
export const MOCK_MAP_CHOROPLETH_JSON = JSON.stringify(MOCK_MAP_CHOROPLETH);

export const MOCK_ADVANCED_CHART_DATA_BY_TYPE: Record<string, string> = {
  scatter: MOCK_CHART_SCATTER_JSON,
  radar: MOCK_CHART_RADAR_JSON,
  heatmap: MOCK_CHART_HEATMAP_JSON,
  funnel: MOCK_CHART_FUNNEL_JSON,
  waterfall: MOCK_CHART_WATERFALL_JSON,
  treemap: MOCK_CHART_TREEMAP_JSON,
  sunburst: MOCK_CHART_SUNBURST_JSON,
  sankey: MOCK_CHART_SANKEY_JSON,
  candlestick: MOCK_CHART_CANDLESTICK_JSON,
  boxplot: MOCK_CHART_BOXPLOT_JSON,
};

export const MOCK_ORG_TREE: DesignerTreeNode[] = [
  {
    id: 'org-root',
    label: 'Head Office',
    children: [
      {
        id: 'sales',
        label: 'Sales',
        children: [
          { id: 'sales-tehran', label: 'Tehran' },
          { id: 'sales-isfahan', label: 'Isfahan' },
        ],
      },
      {
        id: 'engineering',
        label: 'Engineering',
        children: [
          { id: 'eng-frontend', label: 'Frontend' },
          { id: 'eng-backend', label: 'Backend' },
        ],
      },
      { id: 'hr', label: 'Human Resources' },
    ],
  },
];

export const MOCK_ORG_TREE_JSON = JSON.stringify(MOCK_ORG_TREE);

const MOCK_PROJECT_TIMELINE: DesignerTimelineEvent[] = [
  {
    id: 'evt-1',
    title: 'Project kickoff',
    start: '2026-01-15',
    end: '2026-01-15',
    description: 'Stakeholder alignment and scope sign-off',
  },
  {
    id: 'evt-2',
    title: 'Design phase',
    start: '2026-02-01',
    end: '2026-03-15',
    description: 'UX wireframes and component inventory',
  },
  {
    id: 'evt-3',
    title: 'Development sprint 1',
    start: '2026-03-16',
    end: '2026-04-30',
  },
  {
    id: 'evt-4',
    title: 'UAT & launch',
    start: '2026-05-01',
    end: '2026-05-20',
  },
];

export const MOCK_PROJECT_TIMELINE_JSON = JSON.stringify(MOCK_PROJECT_TIMELINE);

const MOCK_KANBAN_BOARD: DesignerKanbanBoard = {
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: 'c1', title: 'Draft data model spec', description: 'CD-O01' },
        { id: 'c2', title: 'Integrate chart library', description: 'CD-O02' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      cards: [
        { id: 'c3', title: 'Bar chart widget', description: 'Canvas + preview' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [
        { id: 'c4', title: 'Phase A spec', description: 'Foundation complete' },
      ],
    },
  ],
};

export const MOCK_KANBAN_BOARD_JSON = JSON.stringify(MOCK_KANBAN_BOARD);

const MOCK_SHEET_DATA: DesignerSheetData = {
  columns: [
    { key: 'product', header: 'Product', type: 'text' },
    { key: 'qty', header: 'Qty', type: 'number' },
    { key: 'price', header: 'Price', type: 'number' },
    { key: 'status', header: 'Status', type: 'select', options: ['In Stock', 'Low Stock', 'Out of Stock'] },
  ],
  rows: [
    { product: 'Coffee Beans', qty: 120, price: 14.99, status: 'In Stock' },
    { product: 'Green Tea', qty: 85, price: 9.99, status: 'In Stock' },
    { product: 'Espresso Maker', qty: 15, price: 129.99, status: 'Low Stock' },
    { product: 'Coffee Grinder', qty: 0, price: 49.99, status: 'Out of Stock' },
  ],
};

export const MOCK_SHEET_DATA_JSON = JSON.stringify(MOCK_SHEET_DATA);

const resolveVisualizationFixtureChartData = (fixtureSet: string): DesignerChartDataRow[] => {
  if (fixtureSet === 'viz-sales-q1' || fixtureSet === 'sales-demo') {
    return MOCK_CHART_SALES_Q1;
  }
  if (fixtureSet === 'empty-state') {
    return [];
  }
  return MOCK_CHART_SALES_Q1;
};

const resolveVisualizationFixtureTreeData = (fixtureSet: string): DesignerTreeNode[] => {
  if (fixtureSet === 'viz-org-tree') {
    return MOCK_ORG_TREE;
  }
  if (fixtureSet === 'empty-state') {
    return [];
  }
  return MOCK_ORG_TREE;
};

const resolveVisualizationFixtureTimelineData = (fixtureSet: string): DesignerTimelineEvent[] => {
  if (fixtureSet === 'viz-project-timeline') {
    return MOCK_PROJECT_TIMELINE;
  }
  if (fixtureSet === 'empty-state') {
    return [];
  }
  return MOCK_PROJECT_TIMELINE;
};
