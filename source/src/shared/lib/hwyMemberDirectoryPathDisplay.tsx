import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  HwyElectoralDivisionPathLinks,
  HwyElectoralProvinceFallbackLink,
} from '../ui/hwy/HwyElectoralDivisionPathLinks';
import {
  isHwyElectoralCirclePathSegment,
  isHwyElectoralMaktabPathSegment,
} from './hwyElectoralPathSegmentGuards';
import type { HwyGeoResponsibilityLevel } from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import {
  formatHwyElectoralCenterPathThroughRegion,
  HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS,
  hwyElectoralBreadcrumbLinkSegments,
  splitHwyElectoralBreadcrumbColumnLines,
  splitHwyElectoralBreadcrumbGridColumnLines,
  splitHwyElectoralBreadcrumbParts,
} from './hwyElectoralBreadcrumbStandard';

const TITLE_PATH_JOIN = ' | ';

const IRAQ_SEGMENT_NAMES = new Set(['iraq', 'العراق']);

/** Base Info roots before country/province in `title_path` breadcrumbs (not shown in member geo cells). */
const GEO_ROOT_SEGMENT_NAMES = new Set([
  'base',
  'الأساس',
  'geographic divisions',
  'التقسيمات الجغرافية',
]);

export const splitHwyTitlePath = (path: string): string[] =>
  path
    .split(/\s*\|\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

const splitTitlePath = splitHwyTitlePath;

const segmentsAfterIraq = (segments: string[]): string[] => {
  const iraqIndex = segments.findIndex((segment) => IRAQ_SEGMENT_NAMES.has(segment.toLowerCase()));
  if (iraqIndex < 0) {
    return segments;
  }
  return segments.slice(iraqIndex + 1);
};

const normalizeGeoPathSegments = (segments: string[]): string[] => {
  const afterCountry = segmentsAfterIraq(segments);
  if (afterCountry.length !== segments.length) {
    return afterCountry;
  }
  let start = 0;
  while (start < segments.length && GEO_ROOT_SEGMENT_NAMES.has(segments[start].toLowerCase())) {
    start += 1;
  }
  return segments.slice(start);
};

const flattenElectoralPathChunks = (chunks: string[]): string[] => {
  const flattened: string[] = [];
  for (const chunk of chunks) {
    const piece = chunk.trim();
    if (!piece) {
      continue;
    }
    if (piece.includes('/')) {
      flattened.push(
        ...piece.split(/\s*\/\s*/).map((segment) => segment.trim()).filter(Boolean),
      );
    } else {
      flattened.push(piece);
    }
  }
  return flattened;
};

const segmentsFromRawPath = (rawPath: unknown): string[] => {
  const text = String(rawPath ?? '').trim();
  if (!text) {
    return [];
  }
  const topLevel = text.includes('|')
    ? splitTitlePath(text)
    : [text];
  const segments = flattenElectoralPathChunks(topLevel);
  return normalizeGeoPathSegments(segments);
};

/** Electoral breadcrumb segments with Iraq / Base Info roots removed. */
export const splitHwyGeoPathDisplaySegments = (rawPath: unknown): string[] => (
  segmentsFromRawPath(rawPath)
);

const titlePathPrefixBeforeGeo = (rawPath: unknown): string[] => {
  const text = String(rawPath ?? '').trim();
  if (!text.includes('|')) {
    return [];
  }
  const all = splitHwyTitlePath(text);
  const geo = segmentsFromRawPath(rawPath);
  if (geo.length === 0) {
    return all;
  }
  const province = geo[0]?.trim();
  if (!province) {
    return all;
  }
  const provinceIndex = all.findIndex((segment) => segment.trim() === province);
  if (provinceIndex <= 0) {
    return [];
  }
  return all.slice(0, provinceIndex);
};

/** Nomination patch path — breadcrumb only through the responsibility level (not deeper). */
export const formatHwyElectoralPathUpToGeoLevel = (
  rawPath: unknown,
  upToLevel: HwyGeoResponsibilityLevel,
): string => {
  const text = String(rawPath ?? '').trim();
  if (!text) {
    return '';
  }
  const prefix = titlePathPrefixBeforeGeo(text);
  const parts = splitHwyElectoralBreadcrumbParts(text);
  const geoSegments: string[] = [];
  for (const { level, field } of HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS) {
    const segment = parts[field]?.trim();
    if (segment) {
      geoSegments.push(segment);
    }
    if (level === upToLevel) {
      break;
    }
  }
  if (geoSegments.length === 0) {
    return text;
  }
  return [...prefix, ...geoSegments].join(TITLE_PATH_JOIN);
};

/** Geo breadcrumb only (no Base Info / Iraq prefix) for pipeline patch vs electoral columns. */
export const formatHwyGeoElectoralPathForDisplay = (
  rawPath: unknown,
  upToLevel?: HwyGeoResponsibilityLevel,
): string => {
  const normalized = upToLevel
    ? formatHwyElectoralPathUpToGeoLevel(rawPath, upToLevel)
    : formatHwyElectoralCenterPathThroughRegion(rawPath);
  const segments = hwyElectoralBreadcrumbLinkSegments(normalized);
  return segments.join(TITLE_PATH_JOIN);
};

export type HwyPathDisplayLines = {
  line1: string;
  line2: string;
  line3?: string;
};

/** Grid «المركز الانتخابي»: line1 province|ghavateh, line2 circle|maktab, line3 region. */
export const splitHwyElectoralDivisionGridPath = (rawPath: unknown): HwyPathDisplayLines => {
  const grid = splitHwyElectoralBreadcrumbGridColumnLines(rawPath);
  return { line1: grid.line1, line2: grid.line2, line3: grid.line3 };
};

/** Dossier / household: collapses maktab+region onto line 2. */
export const splitHwyElectoralDivisionPath = (rawPath: unknown): HwyPathDisplayLines => (
  splitHwyElectoralBreadcrumbColumnLines(rawPath)
);

/** Province / governorate — first level after the country segment in an electoral path. */
export const resolveHwyElectoralProvinceTitle = (rawPath: unknown): string => {
  const segments = segmentsFromRawPath(rawPath);
  return segments[0] ?? '';
};

/**
 * Geo responsibility list column: line 1 = node at the active level (bold in UI);
 * line 2 = ancestor electoral path (province → …), joined with ` | `.
 */
export const formatHwyGeoResponsibilityNodeColumnDisplay = (
  rawPath: unknown,
  leafTitleFallback?: string | null,
): HwyPathDisplayLines => {
  const segments = segmentsFromRawPath(rawPath);
  if (segments.length === 0) {
    const fallback = String(leafTitleFallback ?? '').trim();
    return { line1: fallback, line2: '' };
  }
  return {
    line1: segments[segments.length - 1]!,
    line2: segments.length > 1 ? segments.slice(0, -1).join(TITLE_PATH_JOIN) : '',
  };
};

/** Last segment of a Base Info `title_path` (node label only, not the full breadcrumb). */
export const leafTitleFromGeoPath = (rawPath: unknown): string => {
  const text = String(rawPath ?? '').trim();
  if (!text) {
    return '';
  }
  const segments = splitHwyTitlePath(text);
  return segments.at(-1) ?? text;
};

/** Residence list cell: drop Iraq; one segment per line (typically three levels). */
export const splitHwyResidenceSummaryLines = (rawPath: unknown): string[] =>
  segmentsFromRawPath(rawPath);

/** Grid cells that store one display line per newline (e.g. institute titles). */
export const splitHwyNewlineCellLines = (raw: unknown): string[] => {
  const text = String(raw ?? '').trim();
  if (!text) {
    return [];
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

/**
 * Member dossier similar-members area column: line 1 = province through circle;
 * line 2 = region and below. Segments within each line join with ` | `.
 */
export const splitHwyMemberAreaColumnDisplay = (rawPath: unknown): HwyPathDisplayLines => {
  const segments = segmentsFromRawPath(rawPath);
  if (segments.length === 0) {
    return { line1: '', line2: '' };
  }
  return {
    line1: segments.slice(0, 3).join(TITLE_PATH_JOIN),
    line2: segments.slice(3).join(TITLE_PATH_JOIN),
  };
};

export type HwyElectoralGeoPathFieldParts = {
  province: string;
  district: string;
  circle: string;
  region: string;
  /** When the path has a level after region (often maktab), peeled from the breadcrumb. */
  maktabFromPath: string;
};

const joinMaktabPathSegments = (segments: string[]): string => {
  const parts = segments.map((segment) => segment.trim()).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  if (parts.length === 2 && /^\d+$/.test(parts[1]!)) {
    return `${parts[0]} / ${parts[1]}`;
  }
  return parts.join(TITLE_PATH_JOIN);
};

const mapElectoralGeoSegmentsToFields = (geo: string[]): Omit<HwyElectoralGeoPathFieldParts, 'maktabFromPath'> => {
  const n = geo.length;
  if (n === 0) {
    return { province: '', district: '', circle: '', region: '' };
  }
  if (n >= 4) {
    const second = geo[1]?.trim() ?? '';
    if (isHwyElectoralCirclePathSegment(second)) {
      return {
        province: geo[0] ?? '',
        district: '',
        circle: geo[1] ?? '',
        region: joinMaktabPathSegments(geo.slice(2)),
      };
    }
    return {
      province: geo[0] ?? '',
      district: geo[1] ?? '',
      circle: geo[2] ?? '',
      region: geo[3] ?? '',
    };
  }
  if (n === 3) {
    const middle = geo[1]?.trim() ?? '';
    if (isHwyElectoralCirclePathSegment(middle)) {
      return {
        province: geo[0] ?? '',
        district: '',
        circle: geo[1] ?? '',
        region: geo[2] ?? '',
      };
    }
    return {
      province: geo[0] ?? '',
      district: geo[1] ?? '',
      circle: '',
      region: geo[2] ?? '',
    };
  }
  if (n === 2) {
    return {
      province: geo[0] ?? '',
      district: '',
      circle: '',
      region: geo[1] ?? '',
    };
  }
  return { province: '', district: '', circle: '', region: geo[0] ?? '' };
};

/**
 * Low-level parser for electoral `title_path` segments.
 * Prefer {@link splitHwyElectoralBreadcrumbParts} for Studio order:
 * province → ghavateh (optional) → circle → maktab → region.
 *
 * Legacy field names: `district` = ghavateh, `region` = maktab rung, `maktabFromPath` = region rung.
 */
export const splitHwyElectoralGeoPathFieldParts = (rawPath: unknown): HwyElectoralGeoPathFieldParts => {
  const segments = splitHwyResidenceSummaryLines(rawPath);
  if (segments.length === 0) {
    return { province: '', district: '', circle: '', region: '', maktabFromPath: '' };
  }
  let maktabFromPath = '';
  let geo = segments;
  const last = segments.at(-1)?.trim() ?? '';
  if (last && isHwyElectoralMaktabPathSegment(last)) {
    maktabFromPath = last;
    geo = segments.slice(0, -1);
  } else if (segments.length >= 5) {
    maktabFromPath = segments.at(-1) ?? '';
    geo = segments.slice(0, -1);
  }
  return { ...mapElectoralGeoSegmentsToFields(geo), maktabFromPath };
};

export type HwyElectoralDivisionCellDisplay =
  | { kind: 'electoral'; value: unknown }
  | { kind: 'province'; value: unknown };

/** Row field used when nakhebin electoral path is empty (member `addrProvinceId` → `addrProvinceTitle`). */
export const HWY_ELECTORAL_DIVISION_FALLBACK_FIELD = 'addrProvinceTitle';

/** When electoral path is empty, show province title from address (default `addrProvinceTitle`). */
export const resolveHwyElectoralDivisionCellDisplay = (
  row: Record<string, unknown>,
  electoralFallbackField?: string,
): HwyElectoralDivisionCellDisplay => {
  const electoral = row.electoralDivisionPath ?? row.electoral_division_path;
  if (hwyElectoralBreadcrumbLinkSegments(electoral).length > 0) {
    return {
      kind: 'electoral',
      value: formatHwyElectoralCenterPathThroughRegion(electoral),
    };
  }
  const fallbackKey = (electoralFallbackField?.trim() || HWY_ELECTORAL_DIVISION_FALLBACK_FIELD);
  const snake = fallbackKey.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  const fallbackValue = row[fallbackKey] ?? row[snake];
  if (String(fallbackValue ?? '').trim()) {
    return { kind: 'province', value: fallbackValue };
  }
  return { kind: 'electoral', value: electoral };
};

export const HwyElectoralDivisionPathCell: React.FC<{ value: unknown; className?: string }> = ({
  value,
  className,
}) => <HwyElectoralDivisionPathLinks value={value} layout="twoLine" className={className} />;

export const HwyMemberAreaColumnPathCell: React.FC<{ value: unknown; className?: string }> = ({
  value,
  className,
}) => <HwyElectoralDivisionPathLinks value={value} layout="memberArea" className={className} />;

export type HwyStackedLinesTextAlign = 'start' | 'center';

export const resolveHwyStackedLinesTextAlignFromGridColumn = (column: {
  cellClassName?: string;
  headerClassName?: string;
}): HwyStackedLinesTextAlign => (
  column.cellClassName?.includes('text-center') === true
  || column.headerClassName?.includes('text-center') === true
    ? 'center'
    : 'start'
);

export const HwyStackedLinesCell: React.FC<{
  lines: string[];
  className?: string;
  textAlign?: HwyStackedLinesTextAlign;
}> = ({
  lines,
  className,
  textAlign = 'start',
}) => {
  if (lines.length === 0) {
    return null;
  }

  const centered = textAlign === 'center';

  return (
    <div
      className={cn(
        'flex min-w-0 w-full flex-col leading-snug',
        centered ? 'items-center text-center' : 'text-start',
        className,
      )}
    >
      {lines.map((line, index) => (
        <span
          key={`${index}-${line}`}
          className={cn(
            'block min-w-0 w-full text-xs font-normal text-slate-600',
            centered ? 'text-center' : 'text-start',
            index > 0 ? 'mt-0.5' : null,
          )}
        >
          {line}
        </span>
      ))}
    </div>
  );
};

export const HwyElectoralProvinceFallbackCell: React.FC<{ value: unknown; className?: string }> = ({
  value,
  className,
}) => <HwyElectoralProvinceFallbackLink value={value} className={className} />;

export const HwyNewlineStackedLinesCell: React.FC<{
  value: unknown;
  className?: string;
  textAlign?: HwyStackedLinesTextAlign;
}> = ({
  value,
  className,
  textAlign,
}) => (
  <HwyStackedLinesCell
    lines={splitHwyNewlineCellLines(value)}
    className={className}
    textAlign={textAlign}
  />
);
