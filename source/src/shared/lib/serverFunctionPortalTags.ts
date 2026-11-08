import type { ServerFunctionMetadataJson } from '../../shared/api/contracts/server-functions/types';

const PORTAL_TAG_PREFIX = 'portal:';

export function buildPortalFunctionTag(portalSegment: string): string {
  const normalized = portalSegment.trim().toLowerCase();
  return normalized ? `${PORTAL_TAG_PREFIX}${normalized}` : '';
}

export function parsePortalSegmentFromFunctionTag(tag: string): string | null {
  const normalized = tag.trim().toLowerCase();
  if (!normalized.startsWith(PORTAL_TAG_PREFIX)) {
    return null;
  }
  const segment = normalized.slice(PORTAL_TAG_PREFIX.length).trim();
  return segment || null;
}

export function readPortalSegmentFromMetadata(metadata: ServerFunctionMetadataJson | null | undefined): string {
  const tags = metadata?.apiDoc?.tags ?? [];
  for (const tag of tags) {
    const segment = parsePortalSegmentFromFunctionTag(tag);
    if (segment) {
      return segment;
    }
  }
  return '';
}

export function upsertPortalTagInMetadata(
  metadata: ServerFunctionMetadataJson | null | undefined,
  portalSegment: string,
): ServerFunctionMetadataJson {
  const base: ServerFunctionMetadataJson = metadata ? { ...metadata } : {};
  const apiDoc = { ...(base.apiDoc ?? {}) };
  const withoutPortal = (apiDoc.tags ?? []).filter(
    (tag) => !parsePortalSegmentFromFunctionTag(tag),
  );
  const normalizedSegment = portalSegment.trim().toLowerCase();
  apiDoc.tags = normalizedSegment
    ? [...withoutPortal, buildPortalFunctionTag(normalizedSegment)]
    : withoutPortal;
  return { ...base, apiDoc };
}
