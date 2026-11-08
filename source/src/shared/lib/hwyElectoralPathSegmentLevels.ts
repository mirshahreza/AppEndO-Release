import type { HwyGeoResponsibilityLevel } from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import { hwyGeoDisplayLeafTitle } from '../../domain/hwy/hwyGeoDisplayLeafTitle';
import { splitHwyElectoralBreadcrumbParts } from './hwyElectoralBreadcrumbStandard';
import {
  isHwyElectoralCirclePathSegment,
  isHwyElectoralMaktabPathSegment,
} from './hwyElectoralPathSegmentGuards';

export {
  isHwyElectoralCirclePathSegment,
  isHwyElectoralMaktabPathSegment,
} from './hwyElectoralPathSegmentGuards';

/** Fallback when structured parts do not cover every display segment (mixed `/` sub-levels). */
export const inferHwyGeoResponsibilityLevelFromSegmentLabel = (
  segment: string,
): HwyGeoResponsibilityLevel | null => {
  const text = segment.trim();
  if (!text) {
    return null;
  }
  if (isHwyElectoralCirclePathSegment(text)) {
    return 'circle';
  }
  if (isHwyElectoralMaktabPathSegment(text) || /^روضة\s+/u.test(text)) {
    return 'region';
  }
  if (/^اقتراع\s+/u.test(text) || /^منطقة\s+/u.test(text)) {
    return 'maktab';
  }
  return null;
};

const normalizeSegmentLabel = (segment: string): string => {
  const leaf = hwyGeoDisplayLeafTitle(segment) ?? segment;
  return leaf.trim().toLowerCase();
};

const segmentLabelsMatch = (segment: string, partText: string): boolean => {
  const a = normalizeSegmentLabel(segment);
  const b = normalizeSegmentLabel(partText);
  return a === b || a.startsWith(`${b} /`) || b.startsWith(`${a} /`);
};

/** Geo-responsibility API level per breadcrumb segment (see `hwyElectoralBreadcrumbStandard`). */
export const buildHwyElectoralPathSegmentLevels = (
  segments: readonly string[],
): Array<HwyGeoResponsibilityLevel | null> => {
  if (segments.length === 0) {
    return [];
  }

  const parts = splitHwyElectoralBreadcrumbParts(segments.join(' | '));
  const chain: Array<{ text: string; level: HwyGeoResponsibilityLevel }> = [];
  if (parts.province) {
    chain.push({ text: parts.province, level: 'province' });
  }
  if (parts.ghavateh) {
    chain.push({ text: parts.ghavateh, level: 'ghavateh' });
  }
  if (parts.circle) {
    chain.push({ text: parts.circle, level: 'circle' });
  }
  if (parts.maktab) {
    chain.push({ text: parts.maktab, level: 'maktab' });
  }
  if (parts.region) {
    chain.push({ text: parts.region, level: 'region' });
  }

  const levels: Array<HwyGeoResponsibilityLevel | null> = new Array(segments.length).fill(null);
  let chainIndex = 0;
  for (let segmentIndex = 0; segmentIndex < segments.length && chainIndex < chain.length; segmentIndex += 1) {
    const segment = segments[segmentIndex]?.trim() ?? '';
    const part = chain[chainIndex]!;
    if (segmentLabelsMatch(segment, part.text)) {
      levels[segmentIndex] = part.level;
      chainIndex += 1;
    }
  }

  if (chainIndex === 0 && segments.length === chain.length) {
    for (let i = 0; i < chain.length; i += 1) {
      levels[i] = chain[i]!.level;
    }
  }

  for (let i = 0; i < levels.length; i += 1) {
    if (levels[i] != null) {
      continue;
    }
    levels[i] = inferHwyGeoResponsibilityLevelFromSegmentLabel(segments[i] ?? '');
  }

  return levels;
};

export const resolveHwyElectoralPathSegmentGeoLevelFromSegments = (
  segments: readonly string[],
  segmentIndex: number,
): HwyGeoResponsibilityLevel | null => {
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return null;
  }
  const levels = buildHwyElectoralPathSegmentLevels(segments);
  return levels[segmentIndex] ?? null;
};
