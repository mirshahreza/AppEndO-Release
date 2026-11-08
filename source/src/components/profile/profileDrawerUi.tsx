import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PhoneNumberDisplay } from '../../shared/ui/PhoneNumberDisplay';
import { resolvePhoneContactLinks } from '../../shared/lib/phoneContactLinks';
import { AtmosphereBackdrop } from '../../shared/ui/AtmosphereBackdrop';
import {
  APP_SURFACE_BOX_TONE_CLASS,
  ICON_LABEL_ROW_CLASS,
  SHADOW_MODAL,
  WORKSPACE_SECTION_NAV_TONE_ICON_CLASS,
  type AppSurfaceBoxTone,
} from '../../shared/ui/surfaceClasses';

export type ProfileDrawerTone = AppSurfaceBoxTone;

/** End-edge overlay — never full-bleed; leave a page peek like the hamburger drawer. */
export const PROFILE_DRAWER_PANEL_CLASS = cn(
  'fixed end-0 top-0 bottom-0 z-[160] flex w-[min(400px,calc(100vw-var(--admin-shell-sidebar-width-collapsed,81px)))] flex-col overflow-hidden',
  'border-s border-slate-100 bg-surface-shell',
  SHADOW_MODAL,
  'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
);

/** Host for sidebar atmosphere, clipped to the well. */
export const PROFILE_PATTERN_HOST_CLASS =
  'admin-shell-surface admin-shell-chrome relative overflow-hidden';

/** Identity stack — soft indigo wash, no outline box. */
export const PROFILE_IDENTITY_BOX_CLASS = cn(
  PROFILE_PATTERN_HOST_CLASS,
  'flex flex-col items-center rounded-2xl bg-indigo-50/70 px-4 py-3 text-center',
);

/** Same geometric atmosphere as the studio sidebar — no dotted menu texture. */
export const ProfileDrawerPatternLayers: React.FC = () => (
  <AtmosphereBackdrop focus="sidebar-lower" />
);

export const PROFILE_SECTION_WELL_TONE_CLASS: Record<ProfileDrawerTone, string> = {
  slate: 'bg-slate-50/80',
  violet: 'bg-violet-50/70',
  cyan: 'bg-cyan-50/70',
  indigo: 'bg-indigo-50/70',
  emerald: 'bg-emerald-50/70',
  amber: 'bg-amber-50/70',
  rose: 'bg-rose-50/70',
};

export const PROFILE_ICON_WELL_TONE_CLASS: Record<ProfileDrawerTone, string> = {
  slate: 'bg-slate-100 text-slate-600 group-hover:bg-slate-50 group-hover:text-slate-700',
  violet: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100 group-hover:text-violet-700',
  cyan: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 group-hover:text-cyan-700',
  indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 group-hover:text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700',
  amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100 group-hover:text-amber-700',
  rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100 group-hover:text-rose-700',
};

export const resolveProfileSectionBoxClass = (tone: ProfileDrawerTone = 'slate'): string =>
  cn('rounded-xl px-3 py-1', PROFILE_SECTION_WELL_TONE_CLASS[tone]);

/** Soft well — slate fill, no outline box. */
export const PROFILE_SECTION_BOX_CLASS = resolveProfileSectionBoxClass('slate');

export const PROFILE_ROLE_PILL_CLASS =
  'inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700';

export const PROFILE_ROLE_PILL_PRIMARY_CLASS =
  'inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-800';

export const PROFILE_NAV_LIST_CLASS = 'flex flex-col gap-0.5';

export const PROFILE_NAV_ITEM_CLASS = cn(
  'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm font-semibold text-slate-700',
  'transition-colors hover:bg-white hover:text-slate-900',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
);

export const PROFILE_NAV_ITEM_MUTED_CLASS = 'text-slate-400 hover:bg-white hover:text-slate-600';

export const PROFILE_NAV_ITEM_DANGER_CLASS = 'text-rose-600 hover:bg-rose-50 hover:text-rose-700';

export const PROFILE_NAV_ICON_WELL_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors';

export const PROFILE_NAV_ICON_WELL_MUTED_CLASS =
  'bg-slate-100 text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600';

export const PROFILE_NAV_ICON_WELL_DANGER_CLASS =
  'bg-rose-50 text-rose-500 group-hover:bg-rose-100 group-hover:text-rose-600';

export const PROFILE_KV_LIST_CLASS = 'divide-y divide-white/70';

export const PROFILE_KV_ROW_CLASS = 'flex items-center justify-between gap-4 py-2 first:pt-1 last:pb-1';

export const PROFILE_LOGOUT_BAR_CLASS =
  'flex w-full shrink-0 flex-col border-t border-slate-100 bg-white/70 px-3 py-2';

export const PROFILE_LOGOUT_ITEM_CLASS =
  'text-slate-500 hover:bg-rose-50 hover:text-rose-600';

type ProfileDrawerSectionProps = {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
  tone?: ProfileDrawerTone;
  pattern?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

export const ProfileDrawerSection: React.FC<ProfileDrawerSectionProps> = ({
  icon,
  label,
  action,
  tone = 'slate',
  pattern = false,
  defaultExpanded = false,
  children,
}) => {
  const panelId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-2 text-start',
            'transition-colors hover:bg-white/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
            APP_SURFACE_BOX_TONE_CLASS[tone].title,
          )}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className={cn(ICON_LABEL_ROW_CLASS, 'min-w-0 flex-1')}>
            <span
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden',
                WORKSPACE_SECTION_NAV_TONE_ICON_CLASS[tone],
              )}
            >
              {icon}
            </span>
            <span className="truncate text-xs font-semibold uppercase tracking-wider">
              {label}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              WORKSPACE_SECTION_NAV_TONE_ICON_CLASS[tone],
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div id={panelId} role="region" hidden={!expanded}>
        <div className={cn(resolveProfileSectionBoxClass(tone), pattern && PROFILE_PATTERN_HOST_CLASS)}>
          {pattern ? <ProfileDrawerPatternLayers /> : null}
          <div className={cn(pattern && 'relative z-10')}>{children}</div>
        </div>
      </div>
    </div>
  );
};

type ProfileKvRowProps = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: ProfileDrawerTone;
  phoneContactActions?: boolean;
};

export const ProfileKvRow: React.FC<ProfileKvRowProps> = ({
  label,
  value,
  icon,
  tone = 'slate',
  phoneContactActions = false,
}) => {
  const showPhoneActions = phoneContactActions && resolvePhoneContactLinks(value);

  return (
    <div className={PROFILE_KV_ROW_CLASS}>
      <span className={cn(ICON_LABEL_ROW_CLASS, 'shrink-0 text-xs text-slate-500')}>
        {icon ? (
          <span
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md',
              PROFILE_ICON_WELL_TONE_CLASS[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <span className="inline-flex min-h-6 max-w-full items-center justify-end text-end break-all">
        {showPhoneActions ? (
          <PhoneNumberDisplay
            phone={value}
            className="justify-end"
            textClassName="text-xs font-semibold tracking-tight text-slate-800"
          />
        ) : (
          <span className="text-xs font-semibold tracking-tight text-slate-800">{value}</span>
        )}
      </span>
    </div>
  );
};

type ProfileNavButtonProps = {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  tone?: 'default' | 'muted' | 'danger';
  hue?: ProfileDrawerTone;
  trailing?: React.ReactNode;
  className?: string;
};

export const ProfileNavButton: React.FC<ProfileNavButtonProps> = ({
  children,
  icon,
  onClick,
  onDoubleClick,
  tone = 'default',
  hue = 'slate',
  trailing,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    className={cn(
      PROFILE_NAV_ITEM_CLASS,
      tone === 'muted' && PROFILE_NAV_ITEM_MUTED_CLASS,
      tone === 'danger' && PROFILE_NAV_ITEM_DANGER_CLASS,
      className,
    )}
  >
    <span
      className={cn(
        PROFILE_NAV_ICON_WELL_CLASS,
        tone === 'muted'
          ? PROFILE_NAV_ICON_WELL_MUTED_CLASS
          : tone === 'danger'
            ? PROFILE_NAV_ICON_WELL_DANGER_CLASS
            : PROFILE_ICON_WELL_TONE_CLASS[hue],
      )}
      aria-hidden
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
  </button>
);
