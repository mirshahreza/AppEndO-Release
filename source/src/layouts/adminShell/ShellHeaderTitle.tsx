import React from 'react';
import { cn } from '../../lib/utils';
import { ADMIN_SHELL_HEADER_TITLE_TRAIL_SEPARATOR_CLASS } from '../../shared/ui/surfaceClasses';
import { formatAdminShellHeaderTitle } from './buildAdminShellNav';

export type ShellHeaderTitleProps = {
  groupLabel?: string | null;
  pageLabel?: string;
  titleTrail?: string[];
  fallbackLabel: string;
  className?: string;
};

const stripTruncateClass = (className?: string) => className?.replace(/\btruncate\b/g, '').replace(/\s+/g, ' ').trim();

const renderTitleTrail = (titleTrail: string[], className?: string) => {
  const fullTitle = titleTrail.join(' / ');
  const itemLabel = titleTrail[titleTrail.length - 1] ?? '';
  const prefixSegments = titleTrail.slice(0, -1);

  return (
    <h1
      dir="auto"
      className={cn(stripTruncateClass(className), 'flex min-w-0 flex-1 items-center overflow-hidden font-bold')}
      title={fullTitle}
    >
      {prefixSegments.map((segment, index) => (
        <React.Fragment key={`${segment}-${index}`}>
          <span className="hidden min-w-0 max-w-[min(100%,11rem)] shrink truncate font-semibold text-slate-500 lg:inline">
            {segment}
          </span>
          <span aria-hidden="true" className={ADMIN_SHELL_HEADER_TITLE_TRAIL_SEPARATOR_CLASS}>/</span>
        </React.Fragment>
      ))}
      <span className="min-w-0 flex-1 basis-0 truncate text-slate-800">{itemLabel}</span>
    </h1>
  );
};

/** Compact-row label: last trail segment, otherwise the page name. */
export function resolveShellHeaderCompactTitle({
  groupLabel,
  pageLabel,
  titleTrail,
  fallbackLabel,
}: Pick<ShellHeaderTitleProps, 'groupLabel' | 'pageLabel' | 'titleTrail' | 'fallbackLabel'>): string {
  const resolvedTrail = resolveShellHeaderTitleTrail(titleTrail, groupLabel);
  if (resolvedTrail && resolvedTrail.length > 0) {
    return resolvedTrail[resolvedTrail.length - 1] ?? fallbackLabel;
  }
  return pageLabel?.trim() || fallbackLabel;
}

/** Prefixed trail for nested editors: `{group} / {page} / Edit` when group is known. */
export function resolveShellHeaderTitleTrail(
  titleTrail: string[] | undefined,
  groupLabel?: string | null,
): string[] | undefined {
  if (!titleTrail || titleTrail.length === 0) {
    return titleTrail;
  }

  const trimmedGroup = groupLabel?.trim();
  if (!trimmedGroup || titleTrail[0] === trimmedGroup) {
    return titleTrail;
  }

  return [trimmedGroup, ...titleTrail];
}

export const ShellHeaderTitle: React.FC<ShellHeaderTitleProps> = ({
  groupLabel,
  pageLabel,
  titleTrail,
  fallbackLabel,
  className,
}) => {
  const resolvedTrail = resolveShellHeaderTitleTrail(titleTrail, groupLabel);
  if (resolvedTrail && resolvedTrail.length > 0) {
    return renderTitleTrail(resolvedTrail, className);
  }

  const label = pageLabel || fallbackLabel;
  const title = formatAdminShellHeaderTitle(pageLabel, groupLabel, fallbackLabel);

  if (!groupLabel) {
    return (
      <h1 dir="auto" className={cn(className, 'font-bold text-slate-800')} title={title}>
        {label}
      </h1>
    );
  }

  return (
    <h1 dir="auto" className={cn(className, 'min-w-0 font-bold')} title={title}>
      <span className="hidden font-semibold text-slate-500 lg:inline">{groupLabel}</span>
      <span aria-hidden="true" className={ADMIN_SHELL_HEADER_TITLE_TRAIL_SEPARATOR_CLASS}>
        /
      </span>
      <span className="text-slate-800">{label}</span>
    </h1>
  );
};
