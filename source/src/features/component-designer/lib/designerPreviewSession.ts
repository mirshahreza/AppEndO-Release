import type {
  DesignerBindingDefinitions,
  DesignerDocument,
} from '../../../domain/component-designer/types';
import {
  normalizePortalPagePath,
  isBuiltInComponentAlonePortal,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import {
  STUDIO_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  toPortalRoutePattern,
} from '../../../shared/api/contracts/platform/mountConstants';
import { parseDesignerComponentPath } from './designerDraftPath';

const SESSION_KEY_PREFIX = 'appendo:designer-preview:';
const SESSION_TTL_MS = 5 * 60 * 1000;

const previewSessionStorageKey = (sessionId: string): string => `${SESSION_KEY_PREFIX}${sessionId}`;

const readPreviewSessionRaw = (sessionId: string): string | null => {
  const key = previewSessionStorageKey(sessionId);
  if (typeof window === 'undefined') {
    return null;
  }

  // localStorage is shared across tabs; sessionStorage is per-tab (iframe-only).
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
};

const writePreviewSessionRaw = (sessionId: string, value: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const key = previewSessionStorageKey(sessionId);
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
};

const removePreviewSessionRaw = (sessionId: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const key = previewSessionStorageKey(sessionId);
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
};

export type DesignerPreviewSessionPayload = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  previewResults: Record<string, unknown>;
  createdAt: string;
  simulatedRole?: string;
};

export type DesignerPreviewContextParams = {
  cultureId?: string | null;
  portalSegment?: string | null;
};

export const DEFAULT_PREVIEW_CULTURE_ID = 'us';

export function resolvePreviewCultureId(cultureId: string | null | undefined): string {
  const trimmed = cultureId?.trim();
  return trimmed || DEFAULT_PREVIEW_CULTURE_ID;
}

export function stashDesignerPreviewSession(payload: DesignerPreviewSessionPayload): string {
  const sessionId = globalThis.crypto?.randomUUID?.() ?? `preview-${Date.now()}`;
  writePreviewSessionRaw(sessionId, JSON.stringify(payload));
  return sessionId;
}

export function readDesignerPreviewSession(sessionId: string): DesignerPreviewSessionPayload | null {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    return null;
  }

  const raw = readPreviewSessionRaw(trimmed);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DesignerPreviewSessionPayload;
    const createdAt = Date.parse(parsed.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_TTL_MS) {
      removePreviewSessionRaw(trimmed);
      return null;
    }

    if (!parsed.document || typeof parsed.document !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function touchDesignerPreviewSession(sessionId: string): boolean {
  const payload = readDesignerPreviewSession(sessionId);
  if (!payload) {
    return false;
  }

  writePreviewSessionRaw(sessionId.trim(), JSON.stringify({
    ...payload,
    createdAt: new Date().toISOString(),
  }));
  return true;
}

export function resolveDesignerOutlinePreviewNewTabUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }

  const parsed = new URL(trimmed, 'http://localhost');
  const sessionId = parsed.searchParams.get('session')?.trim() ?? '';
  if (sessionId) {
    touchDesignerPreviewSession(sessionId);
    parsed.searchParams.delete('embedded');
  }

  return `${parsed.pathname}${parsed.search}`;
}

function buildDesignerOutlinePreviewSearchParams(
  sessionId: string,
  context: DesignerPreviewContextParams = {},
  embedded = false,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('session', sessionId);

  const cultureId = context.cultureId?.trim();
  if (cultureId) {
    params.set('culture', cultureId);
  }

  const portalSegment = context.portalSegment?.trim() || COMPONENT_ALONE_PORTAL_SEGMENT;
  if (portalSegment) {
    params.set('portal', portalSegment);
  }

  if (embedded) {
    params.set('embedded', '1');
  }

  return params;
}

export function buildDesignerOutlinePreviewUrl(
  sessionId: string,
  context: DesignerPreviewContextParams = {},
): string {
  return `/studio/component-preview?${buildDesignerOutlinePreviewSearchParams(sessionId, context).toString()}`;
}

export function buildDesignerOutlinePreviewEmbeddedUrl(
  sessionId: string,
  context: DesignerPreviewContextParams = {},
): string {
  return `/studio/component-preview?${buildDesignerOutlinePreviewSearchParams(sessionId, context, true).toString()}`;
}

export type DesignerRuntimePreviewUrlInput = {
  cultureId?: string | null;
  portalSegment?: string | null;
  pageKey: string;
  portalOptions?: ExperienceManifestPortal[];
};

export type DesignerRuntimePreviewUrlResult = {
  /** Canonical portal route shown in the preview URL bar. */
  displayPath: string;
  /** Path loaded by the preview iframe (matches displayPath when a canonical route exists). */
  iframePath: string;
  error?: string;
};

function buildComponentPreviewPath(
  componentPath: string,
  cultureId: string,
  portalSegment: string,
  embedded = false,
): string {
  const params = new URLSearchParams();
  params.set('component', componentPath);
  params.set('culture', cultureId);
  params.set('portal', portalSegment);
  if (embedded) {
    params.set('embedded', '1');
  }
  return `/studio/component-preview?${params.toString()}`;
}

function resolveCanonicalExperiencePath(
  cultureId: string,
  portalSegment: string,
  pageKey: string,
  portalOptions: ExperienceManifestPortal[],
): string | null {
  const portal = portalOptions.find((entry) => entry.segment === portalSegment);
  if (!portal) {
    return null;
  }

  const manifestPageKey = parseDesignerComponentPath(pageKey)?.componentName ?? pageKey;
  const manifestPage = portal.pages.find((page) => page.pageKey === manifestPageKey);
  if (manifestPage) {
    return `/${cultureId}/${normalizePortalPagePath(portal.segment, manifestPage.path)}`;
  }

  if (portal.segment === STUDIO_PORTAL_SEGMENT) {
    return `/${cultureId}/${toPortalRoutePattern(pageKey)}`;
  }

  if (isBuiltInComponentAlonePortal(portal)) {
    return `/${cultureId}/${normalizePortalPagePath(portal.segment, pageKey)}`;
  }

  return null;
}

export function buildDesignerRuntimePreviewUrls(
  input: DesignerRuntimePreviewUrlInput,
): DesignerRuntimePreviewUrlResult {
  const pageKey = input.pageKey.trim();
  if (!pageKey) {
    return {
      displayPath: '',
      iframePath: '',
      error: 'Save the component before running preview.',
    };
  }

  const cultureId = resolvePreviewCultureId(input.cultureId);
  const portalSegment = input.portalSegment?.trim() || COMPONENT_ALONE_PORTAL_SEGMENT;
  const portalOptions = input.portalOptions ?? [];
  const embeddedPreviewPath = buildComponentPreviewPath(pageKey, cultureId, portalSegment, true);

  const portal = portalOptions.find((entry) => entry.segment === portalSegment);
  if (!portal) {
    return {
      displayPath: '',
      iframePath: embeddedPreviewPath,
      error: `Portal "${portalSegment}" is not available.`,
    };
  }

  const canonicalPath = resolveCanonicalExperiencePath(cultureId, portalSegment, pageKey, portalOptions);
  if (canonicalPath) {
    return { displayPath: canonicalPath, iframePath: canonicalPath };
  }

  return {
    displayPath: embeddedPreviewPath,
    iframePath: embeddedPreviewPath,
    error: `This component is not published to portal "${portal.name}". Showing isolated preview.`,
  };
};

export function appendDesignerPreviewReloadParam(url: string, reloadToken: string | number): string {
  const parsed = new URL(url, 'http://localhost');
  parsed.searchParams.set('_reload', String(reloadToken));
  return `${parsed.pathname}${parsed.search}`;
}

export function toDesignerPreviewAbsoluteUrl(path: string): string {
  if (!path.trim()) {
    return '';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }

  return path;
}
