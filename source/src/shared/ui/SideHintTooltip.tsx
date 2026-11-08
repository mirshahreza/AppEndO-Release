import React from 'react';
import { cn } from '../../lib/utils';
import { DARK_TITLE_TONE_CLASS } from './paletteHues';
import { UiTooltip, type UiTooltipPlacement } from './UiTooltip';

/** Hover open delay for dark side/header hints (`SideHintTooltip`, `HeaderHintTooltip`). */
export const SIDE_HINT_TOOLTIP_SHOW_DELAY_MS = 1000;

/** Dark, compact hint chrome — same family as `FieldHintTooltip`, not the default HeroUI tooltip. */
export const SIDE_HINT_TOOLTIP_CONTENT_CLASS = cn(
  'z-[9999] max-w-[18rem] border border-slate-700/70 bg-slate-900 px-3 py-2.5',
  'text-start text-[11px] font-medium leading-relaxed text-slate-100',
  'shadow-xl shadow-slate-900/25',
);

export type SideHintTitleTone = keyof typeof DARK_TITLE_TONE_CLASS;

const HEADER_HINT_FALLBACK_TONES: SideHintTitleTone[] = [
  'cyan',
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
];

export const isDocumentRtl = (): boolean => (
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
);

/** Opens beside the sidebar, toward the page: right in LTR, left in RTL. */
export const resolveOppositeSidebarTooltipPlacement = (
  isRtl?: boolean,
): Extract<UiTooltipPlacement, 'left' | 'right'> => {
  const rtl = isRtl ?? isDocumentRtl();
  return rtl ? 'left' : 'right';
};

export function resolveSideHintTitleTone(
  colorClass?: string | null,
  fallback: SideHintTitleTone = 'cyan',
): SideHintTitleTone {
  const raw = String(colorClass ?? '').trim();
  if (!raw) {
    return fallback;
  }
  if (Object.prototype.hasOwnProperty.call(DARK_TITLE_TONE_CLASS, raw)) {
    return raw as SideHintTitleTone;
  }
  const match = raw.match(/(?:^|\s)text-([a-z]+)-\d+/);
  const hue = match?.[1];
  if (hue && hue !== 'slate' && Object.prototype.hasOwnProperty.call(DARK_TITLE_TONE_CLASS, hue)) {
    return hue as SideHintTitleTone;
  }
  return fallback;
}

export function resolveHeaderHintFallbackTone(index: number): SideHintTitleTone {
  return HEADER_HINT_FALLBACK_TONES[index % HEADER_HINT_FALLBACK_TONES.length] ?? 'cyan';
}

export function buildSideHintContent(
  title: string,
  description?: string | null,
  titleTone?: SideHintTitleTone | string | null,
): React.ReactNode {
  const heading = String(title ?? '').trim();
  const hint = String(description ?? '').trim();
  if (!heading && !hint) {
    return null;
  }

  const tone = resolveSideHintTitleTone(titleTone);
  const distinctHint = heading && hint && hint !== heading ? hint : '';
  const label = heading || hint;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn('text-xs font-bold leading-tight tracking-tight', DARK_TITLE_TONE_CLASS[tone])}>
        {label}
      </span>
      {distinctHint ? (
        <span className="text-[11px] font-normal leading-relaxed text-slate-300">{distinctHint}</span>
      ) : null}
    </div>
  );
}

export type SideHintTooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  isRtl?: boolean;
  className?: string;
  delay?: number;
  /** Override the default opposite-sidebar placement (right in LTR, left in RTL). */
  placement?: UiTooltipPlacement;
};

/**
 * Pretty hover hint that parks on the opposite side of the main sidebar
 * (right in LTR, left in RTL) and does not flip above or below.
 * Pass `placement` to pin a strip (e.g. sidebar-top shortcuts) above instead.
 */
export const SideHintTooltip: React.FC<SideHintTooltipProps> = ({
  content,
  children,
  isRtl,
  className,
  delay,
  placement,
}) => {
  if (content == null || content === false || content === '') {
    return <>{children}</>;
  }

  return (
    <UiTooltip
      content={content}
      contentClassName={SIDE_HINT_TOOLTIP_CONTENT_CLASS}
      placement={placement ?? resolveOppositeSidebarTooltipPlacement(isRtl)}
      shouldFlip={false}
      offset={10}
      delay={delay ?? SIDE_HINT_TOOLTIP_SHOW_DELAY_MS}
      className={className}
    >
      {children}
    </UiTooltip>
  );
};

export type HeaderHintTooltipProps = {
  title: string;
  hint?: string | null;
  tone?: SideHintTitleTone | string | null;
  children: React.ReactNode;
  className?: string;
};

/** Shell-header hover hint: bold hue title under the control, optional description. */
export const HeaderHintTooltip: React.FC<HeaderHintTooltipProps> = ({
  title,
  hint,
  tone,
  children,
  className,
}) => (
  <SideHintTooltip
    content={buildSideHintContent(title, hint, tone)}
    placement="bottom"
    className={cn('inline-flex shrink-0', className)}
  >
    {children}
  </SideHintTooltip>
);
