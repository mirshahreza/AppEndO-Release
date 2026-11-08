export type DashboardWidgetDensity = 'compact' | 'regular' | 'roomy';
export type DashboardWidgetIconColumns = 3 | 4 | 5 | 6;

export type DashboardWidgetFit = {
  width: number;
  height: number;
  span: number;
  columns: 1 | 2 | 3 | 4;
  iconColumns: DashboardWidgetIconColumns;
  density: DashboardWidgetDensity;
  showLabels: boolean;
  showDescriptions: boolean;
  showSubtitle: boolean;
  showFeaturedKpi: boolean;
};

export const DASHBOARD_WIDGET_BODY_PAD_X = 32;
export const DASHBOARD_WIDGET_GRID_GAP = 16;
/** Icon well + card pad + a short English label such as "Change Password". */
export const DASHBOARD_WIDGET_LABEL_CELL_MIN = 200;

export const estimateDashboardWidgetCellWidth = (
  width: number,
  columns: number,
): number => {
  const inner = Math.max(0, width - DASHBOARD_WIDGET_BODY_PAD_X);
  if (columns <= 1) {
    return inner;
  }
  return (inner - DASHBOARD_WIDGET_GRID_GAP * (columns - 1)) / columns;
};

export const resolveDashboardWidgetIconColumns = (width: number): DashboardWidgetIconColumns => {
  if (width < 220) {
    return 3;
  }
  if (width < 300) {
    return 4;
  }
  if (width < 420) {
    return 5;
  }
  return 6;
};

export const DASHBOARD_WIDGET_FIT_FALLBACK: DashboardWidgetFit = {
  width: 480,
  height: 240,
  span: 6,
  columns: 2,
  iconColumns: 6,
  density: 'regular',
  showLabels: true,
  showDescriptions: true,
  showSubtitle: true,
  showFeaturedKpi: false,
};

export const resolveDashboardWidgetFit = (input: {
  width: number;
  height: number;
  span: number;
}): DashboardWidgetFit => {
  const width = input.width > 0 ? input.width : Math.max(input.span, 1) * 72;
  const height = input.height > 0 ? input.height : 220;
  const columns: 1 | 2 | 3 | 4 = width < 280
    ? 1
    : width < 520
      ? 2
      : width < 800
        ? 3
        : 4;
  const density: DashboardWidgetDensity = height < 168 || width < 280
    ? 'compact'
    : height >= 360 && width >= 480
      ? 'roomy'
      : 'regular';
  const showLabels = estimateDashboardWidgetCellWidth(width, columns) >= DASHBOARD_WIDGET_LABEL_CELL_MIN;

  return {
    width,
    height,
    span: input.span,
    columns,
    iconColumns: resolveDashboardWidgetIconColumns(width),
    density,
    showLabels,
    showDescriptions: showLabels && density !== 'compact' && width >= 320,
    showSubtitle: density !== 'compact',
    showFeaturedKpi: width >= 640 && columns >= 3,
  };
};
