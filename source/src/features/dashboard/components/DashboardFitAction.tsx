import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import {
  buildSideHintContent,
  SideHintTooltip,
  type SideHintTitleTone,
} from '../../../shared/ui/SideHintTooltip';
import { NativeButton } from '../../../shared/ui/NativeButton';
import {
  DASHBOARD_CAPTION_ACTION_CLASS,
  DASHBOARD_CAPTION_ACTION_ICON_CLASS,
  DASHBOARD_CAPTION_ACTION_LABEL_CLASS,
  DASHBOARD_CAPTION_ACTION_LABEL_DANGER_CLASS,
  DASHBOARD_CAPTION_ACTION_LABEL_MUTED_CLASS,
  DASHBOARD_ICON_ONLY_TILE_CLASS,
  DASHBOARD_ICON_ONLY_WELL_CLASS,
  DASHBOARD_QUICK_ACTION_CARD_CLASS,
  DASHBOARD_QUICK_ACTION_ICON_WELL_CLASS,
} from '../dashboardDensity';

export type DashboardFitActionTone = 'default' | 'danger' | 'muted';

type DashboardFitActionProps = {
  iconOnly: boolean;
  /** Compact icon with a faint caption underneath — no nested tile chrome. */
  layout?: 'tile' | 'caption';
  icon: React.ReactNode;
  label: string;
  caption?: string;
  description?: string | null;
  showDescription?: boolean;
  tone?: DashboardFitActionTone;
  hintTone?: SideHintTitleTone;
  to?: string;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLButtonElement>;
  trailing?: React.ReactNode;
  className?: string;
};

const resolveCardToneClass = (tone: DashboardFitActionTone, layout: 'tile' | 'caption'): string => {
  if (layout === 'caption') {
    if (tone === 'danger') {
      return 'hover:bg-rose-50/70';
    }
    return '';
  }
  if (tone === 'danger') {
    return 'hover:border-rose-200 hover:bg-rose-50/60';
  }
  if (tone === 'muted') {
    return 'hover:border-slate-200 hover:bg-slate-50';
  }
  return '';
};

const resolveCaptionLabelClass = (tone: DashboardFitActionTone): string => {
  if (tone === 'danger') {
    return DASHBOARD_CAPTION_ACTION_LABEL_DANGER_CLASS;
  }
  if (tone === 'muted') {
    return DASHBOARD_CAPTION_ACTION_LABEL_MUTED_CLASS;
  }
  return '';
};

const resolveLabelClass = (tone: DashboardFitActionTone): string => {
  if (tone === 'danger') {
    return 'text-rose-700 group-hover:text-rose-800';
  }
  if (tone === 'muted') {
    return 'text-slate-500 group-hover:text-slate-700';
  }
  return 'text-slate-800 group-hover:text-slate-900';
};

const resolveHintTone = (
  tone: DashboardFitActionTone,
  hintTone?: SideHintTitleTone,
): SideHintTitleTone => {
  if (hintTone) {
    return hintTone;
  }
  if (tone === 'danger') {
    return 'rose';
  }
  if (tone === 'muted') {
    return 'slate';
  }
  return 'violet';
};

export const DashboardFitAction: React.FC<DashboardFitActionProps> = ({
  iconOnly,
  layout = 'tile',
  icon,
  label,
  caption,
  description,
  showDescription = false,
  tone = 'default',
  hintTone,
  to,
  href,
  onClick,
  onDoubleClick,
  trailing,
  className,
}) => {
  const isCaption = layout === 'caption';
  const hint = isCaption || iconOnly || !showDescription
    ? buildSideHintContent(label, description, resolveHintTone(tone, hintTone))
    : null;
  const cardClass = cn(
    isCaption
      ? DASHBOARD_CAPTION_ACTION_CLASS
      : iconOnly
        ? DASHBOARD_ICON_ONLY_TILE_CLASS
        : DASHBOARD_QUICK_ACTION_CARD_CLASS,
    !isCaption && !iconOnly && 'w-full text-start',
    resolveCardToneClass(tone, layout),
    className,
  );
  const body = isCaption ? (
    <>
      <span className={DASHBOARD_CAPTION_ACTION_ICON_CLASS} aria-hidden>
        {icon}
      </span>
      <span
        className={cn(DASHBOARD_CAPTION_ACTION_LABEL_CLASS, resolveCaptionLabelClass(tone))}
        aria-hidden
      >
        {caption?.trim() || label}
      </span>
    </>
  ) : iconOnly ? (
    <span className={DASHBOARD_ICON_ONLY_WELL_CLASS} aria-hidden>
      {icon}
    </span>
  ) : (
    <>
      <span className={DASHBOARD_QUICK_ACTION_ICON_WELL_CLASS} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex items-center gap-1">
          <span className={cn('truncate text-sm font-semibold', resolveLabelClass(tone))}>
            {label}
          </span>
          {trailing}
        </span>
        {showDescription && description ? (
          <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
    </>
  );

  const tile = to ? (
    <Link to={to} aria-label={label} className={cardClass}>
      {body}
    </Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={cardClass}>
      {body}
    </a>
  ) : (
    <NativeButton
      type="button"
      aria-label={label}
      className={cardClass}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {body}
    </NativeButton>
  );

  return (
    <SideHintTooltip content={hint} placement="top" className="flex w-full min-w-0">
      {tile}
    </SideHintTooltip>
  );
};
