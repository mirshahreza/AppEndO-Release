export const FILE_MANAGER_PREVIEW_ZOOM_DEFAULT = 100;
export const FILE_MANAGER_PREVIEW_ZOOM_MIN = 50;
export const FILE_MANAGER_PREVIEW_ZOOM_MAX = 200;
export const FILE_MANAGER_PREVIEW_ZOOM_STEP = 10;

export const FILE_MANAGER_PREVIEW_MONACO_FONT_SIZE = 13;
export const FILE_MANAGER_PREVIEW_PLAIN_TEXT_FONT_SIZE_PX = 14;

export const fileManagerPreviewZoomFactor = (zoomPercent: number): number => zoomPercent / 100;

export const fileManagerPreviewMonacoFontSize = (zoomPercent: number): number => (
  Math.round(FILE_MANAGER_PREVIEW_MONACO_FONT_SIZE * fileManagerPreviewZoomFactor(zoomPercent))
);

export const fileManagerPreviewPlainTextFontSize = (zoomPercent: number): string => (
  `${FILE_MANAGER_PREVIEW_PLAIN_TEXT_FONT_SIZE_PX * fileManagerPreviewZoomFactor(zoomPercent)}px`
);

export const clampFileManagerPreviewZoom = (zoomPercent: number): number => (
  Math.min(FILE_MANAGER_PREVIEW_ZOOM_MAX, Math.max(FILE_MANAGER_PREVIEW_ZOOM_MIN, zoomPercent))
);
