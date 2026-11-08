import type { HwyGeoResponsibilityLevel } from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import { splitHwyElectoralGeoPathFieldParts } from './hwyMemberDirectoryPathDisplay';

/**
 * Studio electoral breadcrumb order (member lists, geo responsibility, inline officials):
 * province (استان / محافظة) → ghavateh (قاطع, optional) → circle (دائرة) → maktab (مكتب) → region (منطقة).
 *
 * Maps 1:1 to `HwyGeoResponsibilityLevel` for geo-responsibility APIs.
 */
export type HwyElectoralBreadcrumbParts = {
  province: string;
  ghavateh: string;
  circle: string;
  maktab: string;
  region: string;
};

export const HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS: Array<{
  level: HwyGeoResponsibilityLevel;
  field: keyof HwyElectoralBreadcrumbParts;
}> = [
  { level: 'province', field: 'province' },
  { level: 'ghavateh', field: 'ghavateh' },
  { level: 'circle', field: 'circle' },
  { level: 'maktab', field: 'maktab' },
  { level: 'region', field: 'region' },
];

/** Ghavateh is omitted in some member paths when the province has no sector row. */
export const isOptionalHwyElectoralBreadcrumbField = (
  field: keyof HwyElectoralBreadcrumbParts,
): boolean => field === 'ghavateh';

/** Parse raw `title_path` / electoral division path into Studio breadcrumb fields. */
export const splitHwyElectoralBreadcrumbParts = (rawPath: unknown): HwyElectoralBreadcrumbParts => {
  const parts = splitHwyElectoralGeoPathFieldParts(rawPath);
  return {
    province: parts.province,
    ghavateh: parts.district,
    circle: parts.circle,
    maktab: parts.region,
    region: parts.maktabFromPath,
  };
};

const TITLE_PATH_JOIN = ' | ';

const pushTrimmed = (segments: string[], value: string): void => {
  const text = value.trim();
  if (text) {
    segments.push(text);
  }
};

/** Ordered link segments: province → ghavateh? → circle → maktab → region. */
export const hwyElectoralBreadcrumbLinkSegments = (rawPath: unknown): string[] => {
  const parts = splitHwyElectoralBreadcrumbParts(rawPath);
  const segments: string[] = [];
  pushTrimmed(segments, parts.province);
  pushTrimmed(segments, parts.ghavateh);
  pushTrimmed(segments, parts.circle);
  pushTrimmed(segments, parts.maktab);
  pushTrimmed(segments, parts.region);
  return segments;
};

/** Member-directory «المركز الانتخابي» grid column (three visual rows). */
export type HwyElectoralGridColumnLines = {
  /** province | ghavateh (when present) */
  line1: string;
  /** circle | maktab */
  line2: string;
  /** region */
  line3: string;
};

/** Member «المركز الانتخابي» — breadcrumb through region (منطقة), never below. */
export const formatHwyElectoralCenterPathThroughRegion = (rawPath: unknown): string => {
  let segments = hwyElectoralBreadcrumbLinkSegments(rawPath);
  if (segments.length === 0) {
    return '';
  }
  const last = segments[segments.length - 1] ?? '';
  // Region rung is often a school name; only peel an extra sixth level below region.
  if (segments.length > 5 && /مدرسة|school/i.test(last)) {
    segments = segments.slice(0, -1);
  }
  // Studio order: province → ghavateh? → circle → maktab → region (max 5 link levels).
  return segments.slice(0, 5).join(TITLE_PATH_JOIN);
};

export const splitHwyElectoralBreadcrumbGridColumnLines = (
  rawPath: unknown,
): HwyElectoralGridColumnLines => {
  const parts = splitHwyElectoralBreadcrumbParts(rawPath);
  const line1Segments: string[] = [];
  pushTrimmed(line1Segments, parts.province);
  pushTrimmed(line1Segments, parts.ghavateh);
  const line2Segments: string[] = [];
  pushTrimmed(line2Segments, parts.circle);
  pushTrimmed(line2Segments, parts.maktab);
  const line3Segments: string[] = [];
  pushTrimmed(line3Segments, parts.region);
  return {
    line1: line1Segments.join(TITLE_PATH_JOIN),
    line2: line2Segments.join(TITLE_PATH_JOIN),
    line3: line3Segments.join(TITLE_PATH_JOIN),
  };
};

/** Dossier / two-line summaries (legacy consumers). */
export const splitHwyElectoralBreadcrumbColumnLines = (
  rawPath: unknown,
): { line1: string; line2: string } => {
  const grid = splitHwyElectoralBreadcrumbGridColumnLines(rawPath);
  const line2Parts = [grid.line2, grid.line3].filter((line) => line.trim());
  return {
    line1: grid.line1,
    line2: line2Parts.join(TITLE_PATH_JOIN),
  };
};

const normalizeBreadcrumbField = (value: string): string => value.trim().toLowerCase();

/**
 * Member electoral path matches a geo `title_path` up to the clicked responsibility level.
 * Skips optional ghavateh on the member side; uses geo leaf title at the target level.
 */
export const hwyElectoralBreadcrumbPathsAlignUpToLevel = (
  memberElectoralPath: unknown,
  geoTitlePath: unknown,
  upToLevel: HwyGeoResponsibilityLevel,
  geoLeafTitle?: string | null,
): boolean => {
  const memberParts = splitHwyElectoralBreadcrumbParts(memberElectoralPath);
  const rowParts = splitHwyElectoralBreadcrumbParts(geoTitlePath);
  for (const { level: fieldLevel, field } of HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS) {
    const memberValue = memberParts[field]?.trim() ?? '';
    let rowValue = rowParts[field]?.trim() ?? '';
    if (fieldLevel === upToLevel && geoLeafTitle?.trim()) {
      rowValue = geoLeafTitle.trim();
    }
    if (isOptionalHwyElectoralBreadcrumbField(field) && !memberValue) {
      // Member path may omit قاطع.
    } else if (memberValue) {
      if (!rowValue) {
        return false;
      }
      if (normalizeBreadcrumbField(memberValue) !== normalizeBreadcrumbField(rowValue)) {
        return false;
      }
    }
    if (fieldLevel === upToLevel) {
      return true;
    }
  }
  return false;
};
