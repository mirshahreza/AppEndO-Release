/** Shared React Flow canvas chrome — gold sample is the workflow editor GraphCanvas. */

export const CANVAS_FLOW_BACKGROUND_COLOR = '#cbd5e1';
export const CANVAS_FLOW_BACKGROUND_GAP = 16;
export const CANVAS_FLOW_BACKGROUND_SIZE = 1;

export const CANVAS_FLOW_FIT_VIEW_PADDING = 0.2;
export const CANVAS_FLOW_ZOOM_DURATION_MS = 200;

export const CANVAS_FLOW_CONTROLS_PANEL_CLASS = '!m-2';

export const CANVAS_FLOW_MINIMAP_CLASS =
  '!static !m-0 rounded-md border border-slate-300/60 bg-slate-50 shadow-sm';

export const CANVAS_FLOW_MINIMAP_CHROME = {
  pannable: true,
  zoomable: true,
  nodeBorderRadius: 4,
  nodeStrokeWidth: 0,
  bgColor: '#f8fafc',
  maskColor: 'transparent',
  maskStrokeColor: '#94a3b8',
  maskStrokeWidth: 1.25,
  offsetScale: 10,
} as const;
