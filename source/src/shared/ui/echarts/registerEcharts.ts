import * as echarts from 'echarts/core';
import {
  BarChart,
  BoxplotChart,
  CandlestickChart,
  ChordChart,
  CustomChart,
  EffectScatterChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  LinesChart,
  MapChart,
  ParallelChart,
  PictorialBarChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  ThemeRiverChart,
  TreeChart,
  TreemapChart,
} from 'echarts/charts';
import {
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  CalendarComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  DatasetComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  MatrixComponent,
  ParallelComponent,
  PolarComponent,
  RadarComponent,
  SingleAxisComponent,
  ThumbnailComponent,
  TimelineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components';
import {
  AxisBreak,
  LabelLayout,
  LegacyGridContainLabel,
  ScatterJitter,
  UniversalTransition,
} from 'echarts/features';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';

let registered = false;

const register = (modules: unknown[]): void => {
  const usable = modules.filter((module) => typeof module === 'function' || (typeof module === 'object' && module !== null));
  if (usable.length === 0) {
    return;
  }
  echarts.use(usable as Parameters<typeof echarts.use>[0]);
};

export const ensureEchartsRegistered = (): void => {
  if (registered) {
    return;
  }
  // Core plot path first so a later extension cannot leave the host without a renderer.
  register([
    CanvasRenderer,
    SVGRenderer,
    BarChart,
    LineChart,
    PieChart,
    ScatterChart,
    RadarChart,
    HeatmapChart,
    FunnelChart,
    TreemapChart,
    SunburstChart,
    SankeyChart,
    CandlestickChart,
    BoxplotChart,
    GaugeChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DatasetComponent,
    TransformComponent,
    GraphicComponent,
    VisualMapComponent,
    DataZoomComponent,
    ToolboxComponent,
    AriaComponent,
    TitleComponent,
    RadarComponent,
    LabelLayout,
    UniversalTransition,
  ]);
  registered = true;
  try {
    register([
      EffectScatterChart,
      GraphChart,
      TreeChart,
      MapChart,
      ParallelChart,
      LinesChart,
      PictorialBarChart,
      ThemeRiverChart,
      CustomChart,
      ChordChart,
      PolarComponent,
      GeoComponent,
      SingleAxisComponent,
      ParallelComponent,
      CalendarComponent,
      AxisPointerComponent,
      BrushComponent,
      TimelineComponent,
      MarkPointComponent,
      MarkLineComponent,
      MarkAreaComponent,
      DataZoomInsideComponent,
      DataZoomSliderComponent,
      VisualMapContinuousComponent,
      VisualMapPiecewiseComponent,
      MatrixComponent,
      ThumbnailComponent,
      AxisBreak,
      ScatterJitter,
      LegacyGridContainLabel,
    ]);
  } catch {
    // Extra series/components stay optional; core bar/line/pie must still paint.
  }
};

ensureEchartsRegistered();

export const initEcharts = echarts.init;
export const getInstanceByDom = echarts.getInstanceByDom;
export const getInstanceById = echarts.getInstanceById;
export const connectEcharts = echarts.connect;
export const disconnectEcharts = echarts.disconnect;
export const disposeEcharts = echarts.dispose;
export const registerEchartsTheme = echarts.registerTheme;
export const registerEchartsMap = echarts.registerMap;
export const registerEchartsLocale = echarts.registerLocale;
export const registerEchartsLoading = echarts.registerLoading;

export const resolveEchartsRenderer = (): 'canvas' | 'svg' => {
  if (typeof document === 'undefined') {
    return 'svg';
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    return context && typeof context.fillRect === 'function' ? 'canvas' : 'svg';
  } catch {
    return 'svg';
  }
};
