import type { AppEndooDockSide } from './appendooDock';
import { clampAppEndooDockWidth, readStoredAppEndooDockWidth } from './appendooDock';

export const APPENDOO_OPEN_STORAGE_KEY = 'appendo:appendoo-open';
export const APPENDOO_UI_STATE_STORAGE_KEY = 'appendo:appendoo-ui-state';

export type PersistedAppEndooPoint = {
  x: number;
  y: number;
};

export type PersistedAppEndooSize = {
  width: number;
  height: number;
};

export type PersistedAppEndooUiState = {
  dockSide: AppEndooDockSide;
  panelPos: PersistedAppEndooPoint;
  panelSize: PersistedAppEndooSize;
  isMaximized: boolean;
  activeSessionId: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readFiniteNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const readPoint = (value: unknown): PersistedAppEndooPoint | null => {
  if (!isRecord(value)) return null;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (x === null || y === null) return null;
  return { x, y };
};

const readSize = (value: unknown): PersistedAppEndooSize | null => {
  if (!isRecord(value)) return null;
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  if (width === null || height === null || width <= 0 || height <= 0) return null;
  return { width, height };
};

const readDockSide = (value: unknown): AppEndooDockSide | null => (
  value === 'none' || value === 'left' || value === 'right' ? value : null
);

const readActiveSessionId = (value: unknown): number | null => {
  if (value === null) return null;
  const parsed = readFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const resolveOppositeSidebarDockSide = (isRtl?: boolean): 'left' | 'right' => {
  const rtl = isRtl ?? (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');
  return rtl ? 'left' : 'right';
};

export const readStoredAppEndooOpen = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const persistAppEndooOpen = (isOpen: boolean): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, String(isOpen));
  } catch {
    // ignore storage failures
  }
};

export const readStoredAppEndooUiState = (): PersistedAppEndooUiState | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(APPENDOO_UI_STATE_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const dockSide = readDockSide(parsed.dockSide);
    const panelPos = readPoint(parsed.panelPos);
    const panelSize = readSize(parsed.panelSize);
    if (!dockSide || !panelPos || !panelSize) return null;

    return {
      dockSide,
      panelPos,
      panelSize,
      isMaximized: parsed.isMaximized === true,
      activeSessionId: readActiveSessionId(parsed.activeSessionId),
    };
  } catch {
    return null;
  }
};

export const createDefaultDockedAppEndooUiState = (
  isRtl?: boolean,
): PersistedAppEndooUiState => {
  const dockSide = resolveOppositeSidebarDockSide(isRtl);
  const dockWidth = readStoredAppEndooDockWidth();
  const height = typeof window !== 'undefined'
    ? window.innerHeight
    : 800;

  return {
    dockSide,
    panelPos: { x: 0, y: 0 },
    panelSize: { width: clampAppEndooDockWidth(dockWidth), height },
    isMaximized: false,
    activeSessionId: null,
  };
};

export const resolveInitialAppEndooUiState = (
  isRtl?: boolean,
): PersistedAppEndooUiState => (
  readStoredAppEndooUiState() ?? createDefaultDockedAppEndooUiState(isRtl)
);

export const persistAppEndooUiState = (state: PersistedAppEndooUiState): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(APPENDOO_UI_STATE_STORAGE_KEY, JSON.stringify({
      dockSide: state.dockSide,
      panelPos: state.panelPos,
      panelSize: state.panelSize,
      isMaximized: state.isMaximized,
      activeSessionId: state.activeSessionId,
    }));
  } catch {
    // ignore storage failures
  }
};
