import {
  parseDashboardHomeShortcuts,
  type DashboardHomeShortcut,
} from './dashboardHomeShortcuts';
import {
  DASHBOARD_LAYOUT_BLOCK_IDS,
  isDashboardLayoutBlockId,
  type DashboardLayoutBlockId,
} from './dashboardLayoutBlockIds';
import { isDashboardWidgetId, type DashboardWidgetId } from '../api/contracts/home-widgets/id';

export type { DashboardHomeShortcut } from './dashboardHomeShortcuts';
export type { DashboardLayoutBlockId } from './dashboardLayoutBlockIds';
export { DASHBOARD_LAYOUT_BLOCK_IDS, isDashboardLayoutBlockId } from './dashboardLayoutBlockIds';
export {
  isDashboardWidgetId,
  type DashboardWidgetId,
} from '../api/contracts/home-widgets/id';

export type DashboardLayoutMode = 'masonry';

export type DashboardWidgetSize = {
  span?: number;
  start?: number;
  height?: number;
};

export type DashboardWidgetSizes = Partial<Record<DashboardWidgetId, DashboardWidgetSize>>;

export const DASHBOARD_WIDGET_ACCENTS = [
  'slate',
  'violet',
  'cyan',
  'indigo',
  'emerald',
  'amber',
  'rose',
] as const;

export type DashboardWidgetAccent = (typeof DASHBOARD_WIDGET_ACCENTS)[number];

export const DASHBOARD_WIDGET_HEADER_STYLES = ['bar', 'inline'] as const;

export type DashboardWidgetHeaderStyle = (typeof DASHBOARD_WIDGET_HEADER_STYLES)[number];

export type DashboardWidgetChrome = {
  accent?: DashboardWidgetAccent;
  showHeader?: boolean;
  headerStyle?: DashboardWidgetHeaderStyle;
  lockSize?: boolean;
  /** When true, the widget is omitted from the live dashboard until it has content (design mode always shows it). */
  hideWhenEmpty?: boolean;
};

export type DashboardWidgetChromes = Partial<Record<DashboardWidgetId, DashboardWidgetChrome>>;

export type DashboardLayoutPreference = {
  layoutMode: DashboardLayoutMode;
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
  /** Catalog opt-out widgets the operator explicitly added from Design. */
  revealedHomeWidgets?: DashboardWidgetId[];
  widgetSizes: DashboardWidgetSizes;
  widgetChrome: DashboardWidgetChromes;
  homeShortcuts: DashboardHomeShortcut[];
  pageCanvases?: Record<string, unknown>;
};

export const DASHBOARD_WIDGET_MIN_SPAN = 3;
export const DASHBOARD_WIDGET_MAX_SPAN = 12;
export const DASHBOARD_WIDGET_MIN_START = 0;
export const DASHBOARD_WIDGET_MAX_START = DASHBOARD_WIDGET_MAX_SPAN - DASHBOARD_WIDGET_MIN_SPAN;
export const DASHBOARD_WIDGET_MIN_HEIGHT = 112;
export const DASHBOARD_WIDGET_MAX_HEIGHT = 800;

export const isDashboardWidgetSpan = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= DASHBOARD_WIDGET_MIN_SPAN
  && value <= DASHBOARD_WIDGET_MAX_SPAN;

export const isDashboardWidgetHeight = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= DASHBOARD_WIDGET_MIN_HEIGHT
  && value <= DASHBOARD_WIDGET_MAX_HEIGHT;

export const isDashboardWidgetStart = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= DASHBOARD_WIDGET_MIN_START
  && value <= DASHBOARD_WIDGET_MAX_SPAN - 1;

export const stripDashboardWidgetStarts = (sizes: DashboardWidgetSizes): DashboardWidgetSizes => {
  const next: DashboardWidgetSizes = {};
  for (const [key, size] of Object.entries(sizes)) {
    if (!isDashboardWidgetId(key) || !size) {
      continue;
    }
    const rest: DashboardWidgetSize = {};
    if (size.span != null) {
      rest.span = size.span;
    }
    if (size.height != null) {
      rest.height = size.height;
    }
    if (rest.span != null || rest.height != null) {
      next[key] = rest;
    }
  }
  return next;
};

export const clampDashboardWidgetStart = (start: number, span: number): number => {
  const safeSpan = Math.min(
    DASHBOARD_WIDGET_MAX_SPAN,
    Math.max(DASHBOARD_WIDGET_MIN_SPAN, span),
  );
  return Math.min(
    DASHBOARD_WIDGET_MAX_SPAN - safeSpan,
    Math.max(DASHBOARD_WIDGET_MIN_START, start),
  );
};

export const parseDashboardWidgetSizes = (value: unknown): DashboardWidgetSizes => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: DashboardWidgetSizes = {};
  for (const [key, rawSize] of Object.entries(value as Record<string, unknown>)) {
    if (!isDashboardWidgetId(key) || !rawSize || typeof rawSize !== 'object' || Array.isArray(rawSize)) {
      continue;
    }

    const size = rawSize as Record<string, unknown>;
    const next: DashboardWidgetSize = {};
    if (isDashboardWidgetSpan(size.span)) {
      next.span = size.span;
    }
    if (isDashboardWidgetStart(size.start)) {
      next.start = clampDashboardWidgetStart(size.start, next.span ?? DASHBOARD_WIDGET_MIN_SPAN);
    }
    if (isDashboardWidgetHeight(size.height)) {
      next.height = size.height;
    }
    if (next.span != null || next.start != null || next.height != null) {
      result[key] = next;
    }
  }

  return result;
};

const ACCENT_SET = new Set<string>(DASHBOARD_WIDGET_ACCENTS);

export const isDashboardWidgetAccent = (value: unknown): value is DashboardWidgetAccent =>
  typeof value === 'string' && ACCENT_SET.has(value);

const HEADER_STYLE_SET = new Set<string>(DASHBOARD_WIDGET_HEADER_STYLES);

export const isDashboardWidgetHeaderStyle = (value: unknown): value is DashboardWidgetHeaderStyle =>
  typeof value === 'string' && HEADER_STYLE_SET.has(value);

export const compactDashboardWidgetChrome = (
  chrome: DashboardWidgetChrome,
): DashboardWidgetChrome | null => {
  const next: DashboardWidgetChrome = {};
  if (isDashboardWidgetAccent(chrome.accent)) {
    next.accent = chrome.accent;
  }
  if (typeof chrome.showHeader === 'boolean') {
    next.showHeader = chrome.showHeader;
  }
  if (isDashboardWidgetHeaderStyle(chrome.headerStyle)) {
    next.headerStyle = chrome.headerStyle;
  }
  if (typeof chrome.lockSize === 'boolean') {
    next.lockSize = chrome.lockSize;
  }
  if (chrome.hideWhenEmpty === true) {
    next.hideWhenEmpty = true;
  }
  return next.accent || next.showHeader != null || next.headerStyle || next.lockSize != null || next.hideWhenEmpty != null
    ? next
    : null;
};

export const filterDashboardWidgetOrderForDisplay = (
  widgetOrder: DashboardWidgetId[],
  widgetChrome: DashboardWidgetChromes,
  contentEmptyById: Partial<Record<DashboardWidgetId, boolean>>,
  options: { isDesigning: boolean },
): DashboardWidgetId[] => {
  if (options.isDesigning) {
    return widgetOrder;
  }
  return widgetOrder.filter((id) => {
    if (widgetChrome[id]?.hideWhenEmpty !== true) {
      return true;
    }
    return contentEmptyById[id] !== true;
  });
};

export const parseDashboardWidgetChrome = (value: unknown): DashboardWidgetChromes => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: DashboardWidgetChromes = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isDashboardWidgetId(key) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }
    const compact = compactDashboardWidgetChrome(raw as DashboardWidgetChrome);
    if (compact) {
      result[key] = compact;
    }
  }
  return result;
};

const LAYOUT_MODES = new Set<DashboardLayoutMode>(['masonry']);

export const parseDashboardLayout = (value: unknown): DashboardLayoutPreference | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const hasLayoutFields = raw.layoutMode === 'uniform'
    || raw.layoutMode === 'masonry'
    || Array.isArray(raw.widgetOrder)
    || Array.isArray(raw.hiddenWidgets)
    || Array.isArray(raw.homeShortcuts)
    || (raw.widgetSizes != null && typeof raw.widgetSizes === 'object' && !Array.isArray(raw.widgetSizes))
    || (raw.pageCanvases != null && typeof raw.pageCanvases === 'object' && !Array.isArray(raw.pageCanvases));
  if (!hasLayoutFields) {
    return null;
  }

  const layoutMode = 'masonry';

  const widgetOrder = Array.isArray(raw.widgetOrder)
    ? raw.widgetOrder.filter(isDashboardWidgetId)
    : [];

  const hiddenWidgets = Array.isArray(raw.hiddenWidgets)
    ? raw.hiddenWidgets.filter(isDashboardWidgetId)
    : [];

  const revealedHomeWidgets = Array.isArray(raw.revealedHomeWidgets)
    ? raw.revealedHomeWidgets.filter(isDashboardWidgetId)
    : undefined;

  return {
    layoutMode,
    widgetOrder,
    hiddenWidgets,
    revealedHomeWidgets,
    widgetSizes: parseDashboardWidgetSizes(raw.widgetSizes),
    widgetChrome: parseDashboardWidgetChrome(raw.widgetChrome),
    homeShortcuts: parseDashboardHomeShortcuts(raw.homeShortcuts),
    pageCanvases: raw.pageCanvases && typeof raw.pageCanvases === 'object' && !Array.isArray(raw.pageCanvases)
      ? raw.pageCanvases as Record<string, unknown>
      : undefined,
  };
};

export const mergeDashboardWidgetOrder = (
  storedOrder: DashboardWidgetId[] | undefined,
  availableIds: DashboardWidgetId[],
  defaultOrder: DashboardWidgetId[],
): DashboardWidgetId[] => {
  const available = new Set(availableIds);
  const result: DashboardWidgetId[] = [];

  for (const id of storedOrder ?? []) {
    if (available.has(id) && !result.includes(id)) {
      result.push(id);
    }
  }

  for (const id of defaultOrder) {
    if (available.has(id) && !result.includes(id)) {
      result.push(id);
    }
  }

  for (const id of availableIds) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }

  return result;
};

export const resolveVisibleDashboardWidgets = (
  widgetOrder: DashboardWidgetId[],
  hiddenWidgets: DashboardWidgetId[] | undefined,
): DashboardWidgetId[] => {
  const hidden = new Set(hiddenWidgets ?? []);
  return widgetOrder.filter((id) => !hidden.has(id));
};

export const normalizeDashboardLayoutPayload = (payload: unknown): DashboardLayoutPreference | null => {
  const parsed = parseDashboardLayout(payload);
  if (!parsed) {
    return null;
  }

  if (!LAYOUT_MODES.has(parsed.layoutMode)) {
    return null;
  }

  const widgetOrder = [...new Set(parsed.widgetOrder)];
  const hiddenWidgets = [...new Set(parsed.hiddenWidgets)];
  const revealedHomeWidgets = parsed.revealedHomeWidgets
    ? [...new Set(parsed.revealedHomeWidgets)]
    : undefined;

  return {
    layoutMode: parsed.layoutMode,
    widgetOrder,
    hiddenWidgets,
    revealedHomeWidgets,
    widgetSizes: parseDashboardWidgetSizes(parsed.widgetSizes),
    widgetChrome: parseDashboardWidgetChrome(parsed.widgetChrome),
    homeShortcuts: parsed.homeShortcuts,
    pageCanvases: parsed.pageCanvases,
  };
};

export const isDashboardLayoutFullWidthBlock = (blockId: DashboardLayoutBlockId): boolean =>
  blockId === 'kpi';
