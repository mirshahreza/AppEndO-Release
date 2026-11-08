export type PickFileUploadProgressPhase = 'preparing' | 'uploading';

export type PickFileUploadProgressState = {
  total: number;
  completed: number;
  currentFileName: string;
  phase: PickFileUploadProgressPhase;
  /** 0–1 progress within the current file (prepare + upload). */
  withinFileRatio: number;
};

let container: HTMLDivElement | null = null;
let labelEl: HTMLSpanElement | null = null;
let fillEl: HTMLDivElement | null = null;
let outputEl: HTMLSpanElement | null = null;
let state: PickFileUploadProgressState | null = null;

const truncateFileName = (name: string, max = 36): string => {
  const trimmed = name.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
};

const resolveProgressPercent = (progress: PickFileUploadProgressState): number => {
  if (progress.total <= 0) {
    return 0;
  }
  const clampedWithin = Math.min(1, Math.max(0, progress.withinFileRatio));
  const raw = ((progress.completed + clampedWithin) / progress.total) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
};

const resolveProgressLabel = (progress: PickFileUploadProgressState): string => {
  const name = truncateFileName(progress.currentFileName);
  if (progress.phase === 'preparing') {
    return name ? `Preparing ${name}…` : 'Preparing file…';
  }
  if (progress.total > 1) {
    const current = Math.min(progress.total, progress.completed + 1);
    return name
      ? `Uploading ${current} of ${progress.total}: ${name}`
      : `Uploading ${current} of ${progress.total}…`;
  }
  return name ? `Uploading ${name}…` : 'Uploading…';
};

const ensureContainer = (): void => {
  if (container) {
    return;
  }

  container = document.createElement('div');
  container.setAttribute('data-pick-file-upload-progress', 'true');
  container.className = 'fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 pointer-events-none';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');

  const panel = document.createElement('div');
  panel.className = 'pointer-events-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg';

  const header = document.createElement('div');
  header.className = 'mb-1 flex items-center justify-between text-xs text-slate-600';

  labelEl = document.createElement('span');
  outputEl = document.createElement('span');
  header.append(labelEl, outputEl);

  const track = document.createElement('div');
  track.className = 'h-1.5 w-full overflow-hidden rounded-full bg-slate-200';

  fillEl = document.createElement('div');
  fillEl.className = 'h-full rounded-full bg-cyan-600 transition-[width] duration-150 ease-out';
  track.appendChild(fillEl);

  panel.append(header, track);
  container.appendChild(panel);
  document.body.appendChild(container);
};

const renderProgress = (): void => {
  if (!state) {
    return;
  }
  ensureContainer();
  const percent = resolveProgressPercent(state);
  const label = resolveProgressLabel(state);
  if (labelEl) {
    labelEl.textContent = label;
    container?.setAttribute('aria-label', label);
  }
  if (outputEl) {
    outputEl.textContent = `${percent}%`;
  }
  if (fillEl) {
    fillEl.style.width = `${percent}%`;
  }
};

export const showPickFileUploadProgress = (total: number): void => {
  state = {
    total,
    completed: 0,
    currentFileName: '',
    phase: 'preparing',
    withinFileRatio: 0,
  };
  renderProgress();
};

export const updatePickFileUploadProgress = (
  patch: Partial<PickFileUploadProgressState>,
): void => {
  if (!state) {
    return;
  }
  state = { ...state, ...patch };
  renderProgress();
};

export const hidePickFileUploadProgress = (): void => {
  state = null;
  if (container) {
    container.remove();
    container = null;
  }
  labelEl = null;
  fillEl = null;
  outputEl = null;
};
