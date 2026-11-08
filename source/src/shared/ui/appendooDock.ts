export type AppEndooDockSide = 'none' | 'left' | 'right';

export const APPENDOO_DOCK_WIDTH_PX = 420;
export const APPENDOO_DOCK_MIN_WIDTH_PX = 320;
export const APPENDOO_DOCK_MAX_WIDTH_PX = 720;
export const APPENDOO_DOCK_WIDTH_STORAGE_KEY = 'appendo:appendoo-dock-width';

export const APPENDOO_DOCK_PADDING_START_VAR = '--appendoo-dock-padding-inline-start';
export const APPENDOO_DOCK_PADDING_END_VAR = '--appendoo-dock-padding-inline-end';

export const APPENDOO_DOCK_LAYOUT_PADDING_CLASS =
  'ps-[var(--appendoo-dock-padding-inline-start,0px)] pe-[var(--appendoo-dock-padding-inline-end,0px)] transition-[padding-inline] duration-200';

export const clampAppEndooDockWidth = (width: number): number => (
  Math.max(APPENDOO_DOCK_MIN_WIDTH_PX, Math.min(APPENDOO_DOCK_MAX_WIDTH_PX, Math.round(width)))
);

export const readStoredAppEndooDockWidth = (): number => {
  if (typeof window === 'undefined') return APPENDOO_DOCK_WIDTH_PX;
  try {
    const raw = window.localStorage.getItem(APPENDOO_DOCK_WIDTH_STORAGE_KEY);
    if (!raw) return APPENDOO_DOCK_WIDTH_PX;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return APPENDOO_DOCK_WIDTH_PX;
    return clampAppEndooDockWidth(parsed);
  } catch {
    return APPENDOO_DOCK_WIDTH_PX;
  }
};

export const persistAppEndooDockWidth = (width: number): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPENDOO_DOCK_WIDTH_STORAGE_KEY, String(clampAppEndooDockWidth(width)));
  } catch {
    // ignore storage failures
  }
};

export function syncAppEndooDockDocumentInsets(
  dockSide: AppEndooDockSide,
  widthPx: number = APPENDOO_DOCK_WIDTH_PX,
): void {
  const width = dockSide === 'none' ? '0px' : `${clampAppEndooDockWidth(widthPx)}px`;
  const start = dockSide === 'left' ? width : '0px';
  const end = dockSide === 'right' ? width : '0px';

  document.documentElement.style.setProperty(APPENDOO_DOCK_PADDING_START_VAR, start);
  document.documentElement.style.setProperty(APPENDOO_DOCK_PADDING_END_VAR, end);
}

export function clearAppEndooDockDocumentInsets(): void {
  syncAppEndooDockDocumentInsets('none');
}
