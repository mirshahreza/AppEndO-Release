import React, { useMemo } from 'react';

import type { HwyGeoResponsibilityLevel } from '../../../domain/hwy/hwyGeoResponsibilityCatalog';
import { resolveHwyElectoralPathSegmentGeoLevel } from '../../../domain/hwy/hwyGeoResponsibilityElectoralPathNav';
import { inferHwyGeoResponsibilityLevelFromSegmentLabel } from '../../lib/hwyElectoralPathSegmentLevels';
import { cn } from '../../../lib/utils';
import {
  hwyElectoralBreadcrumbLinkSegments,
  splitHwyElectoralBreadcrumbParts,
} from '../../lib/hwyElectoralBreadcrumbStandard';
import { useOpenHwyGeoResponsibilityInlineListDialog } from './hwyGeoResponsibilityInlineListDialogApi';

const TITLE_PATH_JOIN = ' | ';

const segmentLinkClassName =
  'font-inherit cursor-pointer border-0 bg-transparent p-0 text-sky-600 no-underline hover:underline underline-offset-2 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500';

type SegmentLinkLineProps = {
  segments: string[];
  segmentOffset: number;
  segmentCount: number;
  onOpenLevel: (
    level: HwyGeoResponsibilityLevel,
    search: string,
    segmentIndex: number,
  ) => void;
  className?: string;
};

const HwyElectoralPathSegmentLinkLine: React.FC<SegmentLinkLineProps & {
  allSegments: string[];
}> = ({
  segments,
  segmentOffset,
  segmentCount,
  allSegments,
  onOpenLevel,
  className,
}) => {
  if (segments.length === 0) {
    return null;
  }

  return (
    <span className={cn('min-w-0', className)}>
      {segments.map((segment, index) => {
        const level = resolveHwyElectoralPathSegmentGeoLevel(
          segmentOffset + index,
          segmentCount,
          allSegments,
        ) ?? inferHwyGeoResponsibilityLevelFromSegmentLabel(segment);
        const key = `${segmentOffset + index}-${segment}`;
        const separator = index > 0 ? (
          <span key={`${key}-sep`} className="text-inherit">
            {TITLE_PATH_JOIN}
          </span>
        ) : null;

        if (!level) {
          return (
            <React.Fragment key={key}>
              {separator}
              <span>{segment}</span>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={key}>
            {separator}
            <button
              type="button"
              className={segmentLinkClassName}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenLevel(level, segment, segmentOffset + index);
              }}
            >
              {segment}
            </button>
          </React.Fragment>
        );
      })}
    </span>
  );
};

export type HwyElectoralDivisionPathLinksProps = {
  value: unknown;
  /** Single bold line (dossier), electoral grid cell, or similar-members area column. */
  layout?: 'inline' | 'twoLine' | 'memberArea';
  className?: string;
  inlineClassName?: string;
};

export const HwyElectoralDivisionPathLinks: React.FC<HwyElectoralDivisionPathLinksProps> = ({
  value,
  layout = 'twoLine',
  className,
  inlineClassName,
}) => {
  const openInlineList = useOpenHwyGeoResponsibilityInlineListDialog();

  const onOpenLevel = useMemo(
    () => (level: HwyGeoResponsibilityLevel, search: string, segmentIndex: number) => {
      openInlineList({
        level,
        search,
        electoralPath: value,
        segmentIndex,
      });
    },
    [openInlineList, value],
  );

  const allSegments = useMemo(() => hwyElectoralBreadcrumbLinkSegments(value), [value]);

  if (allSegments.length === 0) {
    return null;
  }

  if (layout === 'inline') {
    return (
      <span
        className={cn(
          'block min-w-0 truncate whitespace-nowrap text-sm font-bold text-slate-900',
          inlineClassName,
          className,
        )}
        title={allSegments.join(TITLE_PATH_JOIN)}
      >
        <HwyElectoralPathSegmentLinkLine
          segments={allSegments}
          allSegments={allSegments}
          segmentOffset={0}
          segmentCount={allSegments.length}
          onOpenLevel={onOpenLevel}
        />
      </span>
    );
  }

  const breadcrumbParts = useMemo(() => splitHwyElectoralBreadcrumbParts(value), [value]);
  const line1Segments = useMemo(
    () => [breadcrumbParts.province, breadcrumbParts.ghavateh]
      .map((segment) => segment.trim())
      .filter(Boolean),
    [breadcrumbParts],
  );
  const line2Segments = useMemo(
    () => [breadcrumbParts.circle, breadcrumbParts.maktab]
      .map((segment) => segment.trim())
      .filter(Boolean),
    [breadcrumbParts],
  );
  const line3Segments = useMemo(
    () => (breadcrumbParts.region.trim() ? [breadcrumbParts.region.trim()] : []),
    [breadcrumbParts],
  );
  const line2Offset = line1Segments.length;
  const line3Offset = line1Segments.length + line2Segments.length;

  const renderGridLine = (
    segments: string[],
    segmentOffset: number,
    classNameLine: string,
    withTopMargin: boolean,
  ) => (
    segments.length > 0 ? (
      <HwyElectoralPathSegmentLinkLine
        segments={segments}
        allSegments={allSegments}
        segmentOffset={segmentOffset}
        segmentCount={allSegments.length}
        onOpenLevel={onOpenLevel}
        className={cn(
          'block min-w-0 w-full text-start text-xs',
          classNameLine,
          withTopMargin ? 'mt-0.5' : null,
        )}
      />
    ) : null
  );

  if (layout === 'memberArea') {
    const areaLine1 = allSegments.slice(0, 3);
    const areaLine2 = allSegments.slice(3);
    return (
      <div className={cn('flex min-w-0 w-full flex-col leading-snug text-start', className)}>
        {renderGridLine(areaLine1, 0, 'text-slate-500', false)}
        {renderGridLine(areaLine2, areaLine1.length, 'font-semibold text-slate-800', areaLine1.length > 0)}
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 w-full flex-col leading-snug text-start', className)}>
      {renderGridLine(line1Segments, 0, 'text-slate-500', false)}
      {renderGridLine(line2Segments, line2Offset, 'font-semibold text-slate-800', line1Segments.length > 0)}
      {renderGridLine(line3Segments, line3Offset, 'font-semibold text-slate-900', line1Segments.length + line2Segments.length > 0)}
    </div>
  );
};

export type HwyElectoralProvinceFallbackLinkProps = {
  value: unknown;
  className?: string;
};

/** Province-only fallback when the full electoral path is missing. */
export const HwyElectoralProvinceFallbackLink: React.FC<HwyElectoralProvinceFallbackLinkProps> = ({
  value,
  className,
}) => {
  const title = String(value ?? '').trim();
  const openInlineList = useOpenHwyGeoResponsibilityInlineListDialog();

  if (!title) {
    return null;
  }

  return (
    <button
      type="button"
      className={cn(
        'block min-w-0 w-full text-start text-xs font-semibold',
        segmentLinkClassName,
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openInlineList({
          level: 'province',
          search: title,
          electoralPath: title,
          segmentIndex: 0,
        });
      }}
    >
      {title}
    </button>
  );
};
