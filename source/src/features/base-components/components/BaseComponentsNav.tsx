import React, { useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildMountAbsolutePath } from '../../../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { cn } from '../../../lib/utils';
import { ICON_TONE_CLASS } from '../../../shared/ui/paletteHues';
import {
  AppSearchBox,
  WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS,
  WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
  WORKSPACE_SECTION_NAV_WIDTH_CLASS,
} from '../../../shared/ui';
import type { BaseComponentsPageModel } from '../hooks/useBaseComponentsPage';
import { useBaseComponentsNavSearch } from '../hooks/useBaseComponentsNavSearch';
import { buildBaseComponentsSectionRelativePath } from '../baseComponentsRoute';
import { BASE_COMPONENTS_SECTION_ICONS } from '../baseComponentsSectionIcons';
import { type BaseComponentsSectionEntry } from '../baseComponentsSections';
import { getBaseComponentsSectionNavActiveClass, getBaseComponentsSectionTheme } from '../baseComponentsSectionTheme';
import { BASE_COMPONENTS_PAGE_SURFACE_CLASS } from '../baseComponentsVisualTokens';
import { BaseComponentsPageScrollArea } from './BaseComponentsPageScrollArea';

type BaseComponentsNavProps = {
  page: BaseComponentsPageModel;
};

const STATUS_BADGE_CLASS: Record<'experimental' | 'preferred' | 'deprecated', string> = {
  experimental: 'border border-cyan-200 bg-cyan-50 text-cyan-700',
  preferred: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  deprecated: 'border border-amber-200 bg-amber-50 text-amber-700',
};

const NavSectionLink: React.FC<{
  section: BaseComponentsSectionEntry;
  isActive: boolean;
  toHref: string;
}> = ({ section, isActive, toHref }) => {
  const theme = getBaseComponentsSectionTheme(section.id);

  return (
    <NavLink
      to={toHref}
      className={cn(
        WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
        isActive
          ? cn(WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS, getBaseComponentsSectionNavActiveClass(section.id))
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <span className={theme.iconClass}>
        {BASE_COMPONENTS_SECTION_ICONS[section.id]}
      </span>
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
      {section.status && section.status !== 'supported' ? (
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none', STATUS_BADGE_CLASS[section.status])}>
          {section.status}
        </span>
      ) : null}
    </NavLink>
  );
};

export const BaseComponentsNav: React.FC<BaseComponentsNavProps> = ({ page }) => {
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const toMountPath = useCallback((relativePath: string) => (
    buildMountAbsolutePath(mount?.pathPrefix || `/${STUDIO_PORTAL_SEGMENT}`, relativePath)
  ), [mount?.pathPrefix]);
  const { query, setQuery, groups, matchCount } = useBaseComponentsNavSearch();

  return (
    <div
      className={cn(
        'hidden h-full min-h-0 shrink-0 self-stretch overflow-hidden border-e border-slate-200 md:flex md:flex-col',
        BASE_COMPONENTS_PAGE_SURFACE_CLASS,
        WORKSPACE_SECTION_NAV_WIDTH_CLASS,
      )}
    >
      <AppSearchBox
        value={query}
        onChange={setQuery}
        placeholder="components…"
        ariaLabel="Search base components"
      />
      <BaseComponentsPageScrollArea
        className="flex-1"
        viewportClassName="p-4"
        aria-label="Base components"
      >
        {matchCount === 0 ? (
          <p className="px-2 py-1 text-[11px] text-slate-500">
            {`No components match “${query.trim()}”.`}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map(({ group, sections }) => (
              <div key={group.id} className="space-y-0.5">
                <p className={cn('px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide', ICON_TONE_CLASS[group.hue])}>
                  {group.label}
                </p>
                {sections.map((section) => (
                  <NavSectionLink
                    key={section.id}
                    section={section}
                    isActive={page.activeSection === section.id}
                    toHref={toMountPath(buildBaseComponentsSectionRelativePath(section.id, mountId))}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </BaseComponentsPageScrollArea>
    </div>
  );
};
