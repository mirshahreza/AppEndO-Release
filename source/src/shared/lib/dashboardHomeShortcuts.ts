export const DASHBOARD_HOME_SHORTCUT_MIME = 'application/x-appendo-home-shortcut';
export const DASHBOARD_HOME_SHORTCUT_MAX = 24;
export const DASHBOARD_HOME_PAGE_KEY = 'dashboard';

export type DashboardHomeShortcutKind = 'nav' | 'custom';

export type DashboardHomeShortcut = {
  id: string;
  kind: DashboardHomeShortcutKind;
  pageKey?: string;
  path: string;
  label: string;
  icon?: string;
};

export type DashboardHomeShortcutDraft = Omit<DashboardHomeShortcut, 'id'> & {
  id?: string;
};

const isSafeHttpUrl = (value: URL): boolean =>
  value.protocol === 'http:' || value.protocol === 'https:';

const URL_SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const normalizeDashboardHomeShortcutPath = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (URL_SCHEME_PREFIX.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!isSafeHttpUrl(url)) {
        return null;
      }
      if (typeof window !== 'undefined' && url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}` || '/';
      }
      return url.href;
    } catch {
      return null;
    }
  }

  return `/${trimmed.replace(/^\/+/, '')}`;
};

export const isDashboardHomePageKey = (pageKey: string | undefined): boolean =>
  pageKey === DASHBOARD_HOME_PAGE_KEY;

export const createDashboardHomeShortcutId = (draft: DashboardHomeShortcutDraft): string => {
  if (draft.id?.trim()) {
    return draft.id.trim();
  }
  if (draft.kind === 'nav' && draft.pageKey?.trim()) {
    return `nav:${draft.pageKey.trim()}`;
  }
  return `custom:${draft.path}`;
};

export const createDashboardHomeShortcut = (
  draft: DashboardHomeShortcutDraft,
): DashboardHomeShortcut | null => {
  const path = normalizeDashboardHomeShortcutPath(draft.path);
  const label = draft.label.trim();
  if (!path || !label || isDashboardHomePageKey(draft.pageKey)) {
    return null;
  }

  const shortcut: DashboardHomeShortcut = {
    id: createDashboardHomeShortcutId({ ...draft, path }),
    kind: draft.kind,
    path,
    label,
  };
  if (draft.pageKey?.trim() && !isDashboardHomePageKey(draft.pageKey)) {
    shortcut.pageKey = draft.pageKey.trim();
  }
  if (draft.icon?.trim()) {
    shortcut.icon = draft.icon.trim();
  }
  return shortcut;
};

export const parseDashboardHomeShortcuts = (value: unknown): DashboardHomeShortcut[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: DashboardHomeShortcut[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }
    const item = raw as Record<string, unknown>;
    const kind = item.kind === 'custom' ? 'custom' : item.kind === 'nav' ? 'nav' : null;
    if (!kind || typeof item.path !== 'string' || typeof item.label !== 'string') {
      continue;
    }
    const shortcut = createDashboardHomeShortcut({
      id: typeof item.id === 'string' ? item.id : undefined,
      kind,
      pageKey: typeof item.pageKey === 'string' ? item.pageKey : undefined,
      path: item.path,
      label: item.label,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
    });
    if (!shortcut || seen.has(shortcut.id) || seen.has(shortcut.path)) {
      continue;
    }
    seen.add(shortcut.id);
    seen.add(shortcut.path);
    result.push(shortcut);
    if (result.length >= DASHBOARD_HOME_SHORTCUT_MAX) {
      break;
    }
  }
  return result;
};

export const mergeDashboardHomeShortcut = (
  current: DashboardHomeShortcut[],
  shortcut: DashboardHomeShortcut,
): DashboardHomeShortcut[] => {
  if (current.some((item) => item.id === shortcut.id || item.path === shortcut.path)) {
    return current;
  }
  if (current.length >= DASHBOARD_HOME_SHORTCUT_MAX) {
    return current;
  }
  return [...current, shortcut];
};

export const readDashboardHomeShortcutDrag = (dataTransfer: DataTransfer): DashboardHomeShortcut | null => {
  const raw = dataTransfer.getData(DASHBOARD_HOME_SHORTCUT_MIME) || dataTransfer.getData('text/plain');
  if (!raw) {
    return null;
  }
  try {
    return createDashboardHomeShortcut(JSON.parse(raw) as DashboardHomeShortcutDraft);
  } catch {
    return null;
  }
};

export const writeDashboardHomeShortcutDrag = (
  dataTransfer: DataTransfer,
  draft: DashboardHomeShortcutDraft,
): boolean => {
  const shortcut = createDashboardHomeShortcut(draft);
  if (!shortcut) {
    return false;
  }
  const payload = JSON.stringify(shortcut);
  dataTransfer.setData(DASHBOARD_HOME_SHORTCUT_MIME, payload);
  dataTransfer.setData('text/plain', payload);
  dataTransfer.effectAllowed = 'copy';
  return true;
};

export const writeNavHomeShortcutDrag = (
  dataTransfer: DataTransfer,
  item: { pageKey?: string; path: string; label?: string; icon?: string },
): boolean => writeDashboardHomeShortcutDrag(dataTransfer, {
  kind: 'nav',
  pageKey: item.pageKey,
  path: item.path,
  label: item.label?.trim() || 'Page',
  icon: item.icon,
});

type HomeShortcutAdder = (shortcut: DashboardHomeShortcut) => boolean;

let liveAdder: HomeShortcutAdder | null = null;

export const registerHomeShortcutAdder = (adder: HomeShortcutAdder): (() => void) => {
  liveAdder = adder;
  return () => {
    if (liveAdder === adder) {
      liveAdder = null;
    }
  };
};

export const addDashboardHomeShortcut = (draft: DashboardHomeShortcutDraft): boolean => {
  const shortcut = createDashboardHomeShortcut(draft);
  if (!shortcut) {
    return false;
  }
  if (liveAdder) {
    return liveAdder(shortcut);
  }
  window.dispatchEvent(new CustomEvent<DashboardHomeShortcut>(HOME_SHORTCUT_FALLBACK_EVENT, { detail: shortcut }));
  return true;
};

export const HOME_SHORTCUT_FALLBACK_EVENT = 'appendo:home-shortcut-fallback';

let dashboardDesignMode = false;
const dashboardDesignModeListeners = new Set<() => void>();

const emitDashboardDesignMode = (): void => {
  dashboardDesignModeListeners.forEach((listener) => listener());
};

/** Sidebar reads this so nav items are only draggable while Home design mode is on. */
export const setDashboardDesignMode = (enabled: boolean): void => {
  if (dashboardDesignMode === enabled) {
    return;
  }
  dashboardDesignMode = enabled;
  emitDashboardDesignMode();
};

export const subscribeDashboardDesignMode = (listener: () => void): (() => void) => {
  dashboardDesignModeListeners.add(listener);
  return () => {
    dashboardDesignModeListeners.delete(listener);
  };
};

export const getDashboardDesignMode = (): boolean => dashboardDesignMode;
