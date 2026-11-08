import {
  GEO_BASE_INFO_ROOT_ID,
  GEO_BASE_INFO_ROOT_TITLE_EN,
  ORG_BASE_INFO_ROOT_ID,
  ORG_BASE_INFO_ROOT_TITLE_EN,
  SCOPE_DIMENSION_GEO,
  SCOPE_DIMENSION_ORG,
} from '../../../shared/api/contracts/org-geo/constants';
import type { BaseInfoRow } from '../../base-info/types';
import { geoNodeKindColor, resolveGeoNodeKind, resolveGeoNodeTypeLabel } from './orgGeoNodeKind';

export type OrgGeoChartAccent = 'sky' | 'emerald';

/** Shared chart workspace knobs — pages pass a preset; UI stays one component. */
export type OrgGeoWorkspaceConfig = {
  rootId: string;
  rootTitleFallback: string;
  entityLabel: string;
  bandClassName: string;
  accent: OrgGeoChartAccent;
  dimensionKey: typeof SCOPE_DIMENSION_ORG | typeof SCOPE_DIMENSION_GEO;
  iconPickerAriaLabel: string;
  fallbackIcon: string;
  levelLabel: (depth: number) => string;
  /** When true, the base_info tree root is omitted; direct children are diagram entry points. */
  hideChartRootInDiagram?: boolean;
  /** Chart branches stay open through this depth (0 = view root). Default 1. */
  defaultChartOpenDepth?: number;
  /** Tree grid: expand loaded nodes up to this depth under the workspace root on first load. */
  initialTreeExpandedDepth?: number;
  /** Show Canvas / Datasheet toggle in the toolbar. */
  supportsDatasheetView?: boolean;
  /** Soft per-depth chart colors when the root metadata has no level color saved. */
  defaultChartLevelColor?: (depth: number) => string;
  /** Card type badge + optional per-node color from row data (geo kinds). */
  resolveNodeTypeLabel?: (row: BaseInfoRow) => string | null;
  resolveNodeAccentColor?: (row: BaseInfoRow) => string | null;
};

/** Reference depth labels when ghavateh is present (most provinces skip this level). */
const GEO_DEPTH_LEVEL_LABELS = [
  'Province',
  'Ghavateh',
  'Circle',
  'Maktab',
  'Region',
] as const;

export const geoChartDefaultLevelColor = (depth: number): string => {
  const idx = Math.max(0, Math.floor(depth));
  const labels = GEO_DEPTH_LEVEL_LABELS;
  return ['#8FAF9A', '#C4A88E', '#7BA7C4', '#A3B18A', '#B8A9C9'][
    Math.min(idx, labels.length - 1)
  ];
};

export const ORGANIZATION_CHART_WORKSPACE_CONFIG: OrgGeoWorkspaceConfig = {
  rootId: ORG_BASE_INFO_ROOT_ID,
  rootTitleFallback: ORG_BASE_INFO_ROOT_TITLE_EN,
  entityLabel: 'organization unit',
  bandClassName: 'from-sky-50/80 via-white to-white',
  accent: 'sky',
  dimensionKey: SCOPE_DIMENSION_ORG,
  iconPickerAriaLabel: 'Choose unit icon',
  fallbackIcon: 'Network',
  levelLabel: (depth) => {
    if (depth <= 0) return 'Organization';
    if (depth === 1) return 'Unit';
    return 'Team';
  },
};

export const GEOGRAPHIC_DIVISIONS_WORKSPACE_CONFIG: OrgGeoWorkspaceConfig = {
  rootId: GEO_BASE_INFO_ROOT_ID,
  rootTitleFallback: GEO_BASE_INFO_ROOT_TITLE_EN,
  hideChartRootInDiagram: true,
  defaultChartOpenDepth: 2,
  initialTreeExpandedDepth: 1,
  supportsDatasheetView: true,
  defaultChartLevelColor: geoChartDefaultLevelColor,
  resolveNodeTypeLabel: resolveGeoNodeTypeLabel,
  resolveNodeAccentColor: (row) => geoNodeKindColor(resolveGeoNodeKind(row)),
  entityLabel: 'place',
  bandClassName: 'from-emerald-50/80 via-white to-white',
  accent: 'emerald',
  dimensionKey: SCOPE_DIMENSION_GEO,
  iconPickerAriaLabel: 'Choose place icon',
  fallbackIcon: 'MapPin',
  levelLabel: (depth) => {
    const idx = Math.max(0, Math.floor(depth));
    return GEO_DEPTH_LEVEL_LABELS[Math.min(idx, GEO_DEPTH_LEVEL_LABELS.length - 1)] ?? `Level ${depth}`;
  },
};

const ACCENT_TINT = {
  sky: {
    tint: 'text-sky-800',
    linkTint: 'text-sky-700',
  },
  emerald: {
    tint: 'text-emerald-800',
    linkTint: 'text-emerald-700',
  },
} as const;

export const accentTextClasses = (accent: OrgGeoChartAccent) => ACCENT_TINT[accent];
