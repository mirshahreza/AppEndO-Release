import type { DesignerBindingDefinitions, DesignerStoreSegment } from './types';
import { getStoreSegments } from './bindingRegistry';

export type DesignerStorePersistMode = 'none' | 'session' | 'local';

const STORAGE_PREFIX = 'appendo.designer-store.v1';

/** Toolbar filters / multi-select selections — always remembered in localStorage. */
export const DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS = new Set<string>(['gridToolbar']);

export const resolveDesignerStoreSegmentPersistMode = (
  segmentId: string,
  segment?: DesignerStoreSegment | null,
): DesignerStorePersistMode => {
  const explicit = segment?.persist;
  if (explicit === 'local' || explicit === 'session') {
    return explicit;
  }
  if (DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS.has(segmentId)) {
    return 'local';
  }
  return 'none';
};

export const buildDesignerStorePersistStorageKey = (
  documentKey: string,
  segmentId: string,
): string => {
  const doc = documentKey.trim() || 'anonymous';
  const segment = segmentId.trim() || 'segment';
  return `${STORAGE_PREFIX}:${doc}:${segment}`;
};

const storageForMode = (mode: Exclude<DesignerStorePersistMode, 'none'>): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return mode === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

export const readPersistedDesignerStoreSegment = (
  documentKey: string,
  segmentId: string,
  mode: Exclude<DesignerStorePersistMode, 'none'>,
): unknown | undefined => {
  const storage = storageForMode(mode);
  if (!storage) {
    return undefined;
  }

  try {
    const raw = storage.getItem(buildDesignerStorePersistStorageKey(documentKey, segmentId));
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

export const writePersistedDesignerStoreSegment = (
  documentKey: string,
  segmentId: string,
  mode: Exclude<DesignerStorePersistMode, 'none'>,
  value: unknown,
): void => {
  const storage = storageForMode(mode);
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      buildDesignerStorePersistStorageKey(documentKey, segmentId),
      JSON.stringify(value ?? null),
    );
  } catch {
    // ignore quota / privacy errors
  }
};

export const collectPersistableDesignerStoreSegmentIds = (
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  store?: Record<string, unknown>,
): string[] => {
  const segments = getStoreSegments((bindingDefinitions ?? {}) as DesignerBindingDefinitions) ?? {};
  const ids = new Set<string>([
    ...Object.keys(segments),
    ...DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS,
  ]);
  if (store) {
    for (const key of Object.keys(store)) {
      if (DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS.has(key)) {
        ids.add(key);
      }
    }
  }
  return [...ids].sort();
};

export const applyPersistedDesignerStoreSegments = (
  store: Record<string, unknown>,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  documentKey: string | undefined,
): Record<string, unknown> => {
  const key = documentKey?.trim();
  if (!key) {
    return store;
  }

  const segments = getStoreSegments((bindingDefinitions ?? {}) as DesignerBindingDefinitions) ?? {};
  let next = store;

  for (const segmentId of collectPersistableDesignerStoreSegmentIds(bindingDefinitions, store)) {
    const mode = resolveDesignerStoreSegmentPersistMode(segmentId, segments[segmentId]);
    if (mode === 'none') {
      continue;
    }
    const stored = readPersistedDesignerStoreSegment(key, segmentId, mode);
    if (stored === undefined) {
      continue;
    }
    if (next === store) {
      next = { ...store };
    }
    next[segmentId] = stored;
  }

  return next;
};

export const persistDesignerStoreSegments = (
  store: Record<string, unknown>,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  documentKey: string | undefined,
): void => {
  const key = documentKey?.trim();
  if (!key) {
    return;
  }

  const segments = getStoreSegments((bindingDefinitions ?? {}) as DesignerBindingDefinitions);
  for (const segmentId of collectPersistableDesignerStoreSegmentIds(bindingDefinitions, store)) {
    const mode = resolveDesignerStoreSegmentPersistMode(segmentId, segments[segmentId]);
    if (mode === 'none') {
      continue;
    }
    if (!(segmentId in store)) {
      continue;
    }
    writePersistedDesignerStoreSegment(key, segmentId, mode, store[segmentId]);
  }
};

export const resolveDesignerStoreDocumentKey = (
  document?: { id?: string; name?: string } | null,
): string => {
  const name = typeof document?.name === 'string' ? document.name.trim() : '';
  if (name) {
    return name;
  }
  const id = typeof document?.id === 'string' ? document.id.trim() : '';
  return id || 'anonymous';
};
