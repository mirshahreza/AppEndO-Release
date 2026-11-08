export const APPENDOO_COMPANION_SIZE_PX = 72;
export const APPENDOO_COMPANION_COMPACT_SIZE_PX = 54;
export const APPENDOO_COMPANION_MARGIN_PX = 12;
export const APPENDOO_COMPANION_HOME_END_GAP_PX = 24;
export const APPENDOO_COMPANION_HOME_BOTTOM_GAP_PX = 88;
export const APPENDOO_COMPANION_TUCK_SLIVER_PX = 22;
export const APPENDOO_COMPANION_NEAR_PX = 140;
export const APPENDOO_COMPANION_SLEEP_AFTER_MS = 35_000;
export const APPENDOO_COMPANION_SURPRISE_SPEED_PX_PER_MS = 0.85;
export const APPENDOO_COMPANION_DRAG_THRESHOLD_PX = 6;
export const APPENDOO_COMPANION_POSITION_STORAGE_KEY = 'appendo:appendoo-companion-position';
export const APPENDOO_COMPANION_MOOD_EVENT = 'appendoo-companion-mood';

export type AppendooCompanionFace =
  | 'idle'
  | 'curious'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'sleepy'
  | 'celebrate'
  | 'oops'
  | 'grabbed';

export type AppendooCompanionTuckSide = 'left' | 'right';

export type AppendooCompanionPoint = {
  x: number;
  y: number;
};

export type AppendooCompanionPosition = AppendooCompanionPoint & {
  tucked: AppendooCompanionTuckSide | null;
};

export type AppendooCompanionMoodDetail = {
  face: AppendooCompanionFace;
  durationMs?: number;
};
