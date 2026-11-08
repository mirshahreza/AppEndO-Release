import {
  APPENDOO_COMPANION_HOME_BOTTOM_GAP_PX,
  APPENDOO_COMPANION_HOME_END_GAP_PX,
  APPENDOO_COMPANION_MARGIN_PX,
  APPENDOO_COMPANION_POSITION_STORAGE_KEY,
  APPENDOO_COMPANION_SIZE_PX,
  APPENDOO_COMPANION_TUCK_SLIVER_PX,
  type AppendooCompanionPoint,
  type AppendooCompanionPosition,
  type AppendooCompanionTuckSide,
} from './appendooCompanion.types';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readFiniteNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const isRtlDocument = (): boolean => (
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
);

export const resolveCompanionHomePosition = (
  viewportWidth: number,
  viewportHeight: number,
  size = APPENDOO_COMPANION_SIZE_PX,
  isRtl = false,
): AppendooCompanionPoint => ({
  x: isRtl
    ? APPENDOO_COMPANION_HOME_END_GAP_PX
    : viewportWidth - size - APPENDOO_COMPANION_HOME_END_GAP_PX,
  y: viewportHeight - size - APPENDOO_COMPANION_HOME_BOTTOM_GAP_PX,
});

export const clampCompanionPosition = (
  point: AppendooCompanionPoint,
  viewportWidth: number,
  viewportHeight: number,
  size = APPENDOO_COMPANION_SIZE_PX,
): AppendooCompanionPoint => {
  const maxX = Math.max(APPENDOO_COMPANION_MARGIN_PX, viewportWidth - size - APPENDOO_COMPANION_MARGIN_PX);
  const maxY = Math.max(APPENDOO_COMPANION_MARGIN_PX, viewportHeight - size - APPENDOO_COMPANION_MARGIN_PX);
  return {
    x: Math.min(maxX, Math.max(APPENDOO_COMPANION_MARGIN_PX, point.x)),
    y: Math.min(maxY, Math.max(APPENDOO_COMPANION_MARGIN_PX, point.y)),
  };
};

export const resolveTuckSideFromDrop = (
  x: number,
  viewportWidth: number,
  size = APPENDOO_COMPANION_SIZE_PX,
): AppendooCompanionTuckSide | null => {
  if (x <= APPENDOO_COMPANION_MARGIN_PX + 4) return 'left';
  if (x >= viewportWidth - size - APPENDOO_COMPANION_MARGIN_PX - 4) return 'right';
  return null;
};

export const tuckedCompanionPosition = (
  side: AppendooCompanionTuckSide,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  size = APPENDOO_COMPANION_SIZE_PX,
): AppendooCompanionPosition => {
  const clamped = clampCompanionPosition({ x: 0, y }, viewportWidth, viewportHeight, size);
  return {
    x: side === 'left'
      ? APPENDOO_COMPANION_TUCK_SLIVER_PX - size
      : viewportWidth - APPENDOO_COMPANION_TUCK_SLIVER_PX,
    y: clamped.y,
    tucked: side,
  };
};

export const readStoredCompanionPosition = (): AppendooCompanionPosition | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(APPENDOO_COMPANION_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const x = readFiniteNumber(parsed.x);
    const y = readFiniteNumber(parsed.y);
    if (x === null || y === null) return null;
    const tucked = parsed.tucked === 'left' || parsed.tucked === 'right' ? parsed.tucked : null;
    return { x, y, tucked };
  } catch {
    return null;
  }
};

export const persistCompanionPosition = (position: AppendooCompanionPosition): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      APPENDOO_COMPANION_POSITION_STORAGE_KEY,
      JSON.stringify({
        x: position.x,
        y: position.y,
        tucked: position.tucked,
      }),
    );
  } catch {
    // ignore storage failures
  }
};

export const resolveInitialCompanionPosition = (
  viewportWidth: number,
  viewportHeight: number,
  isRtl = false,
): AppendooCompanionPosition => {
  const stored = readStoredCompanionPosition();
  if (!stored) {
    return {
      ...clampCompanionPosition(
        resolveCompanionHomePosition(viewportWidth, viewportHeight, APPENDOO_COMPANION_SIZE_PX, isRtl),
        viewportWidth,
        viewportHeight,
      ),
      tucked: null,
    };
  }

  if (stored.tucked) {
    return tuckedCompanionPosition(
      stored.tucked,
      stored.y,
      viewportWidth,
      viewportHeight,
    );
  }

  return {
    ...clampCompanionPosition(stored, viewportWidth, viewportHeight),
    tucked: null,
  };
};
