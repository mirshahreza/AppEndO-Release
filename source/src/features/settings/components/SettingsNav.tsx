import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  settingsScopeHintKey,
  settingsScopeTitleKey,
  settingsSectionLabelKey,
} from '../../../core/culture/translations/cultureKeyHelpers';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { cn } from '../../../lib/utils';
import {
  WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS,
  WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
  WORKSPACE_SECTION_NAV_WIDTH_CLASS,
} from '../../../shared/ui';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { buildSettingsSectionRelativePath } from '../settingsRoute';
import { SettingsSectionIcon } from '../settingsSectionIcons';
import { getSettingsSectionNavActiveClass } from '../settingsSectionSemantics';
import {
  NODE_NAV_SEPARATORS,
  PLATFORM_WIDE_NAV_SEPARATORS,
  SETTINGS_SIDEBAR_NODE_SECTIONS,
  SETTINGS_SIDEBAR_PLATFORM_SECTIONS,
  type SettingsNavEntry,
} from '../settingsSections';
import type { SectionId } from '../types';
import { SettingsNavScopeHint } from './SettingsNavScopeHint';

type SettingsNavProps = {
  page: SettingsPageModel;
};

const NavSectionGroup: React.FC<{
  title: string;
  hint: string;
  sections: SettingsNavEntry[];
  separatorBefore?: SectionId[];
  page: SettingsPageModel;
  toMountPath: (path: string) => string;
  mountId: string;
  sectionLabel: (id: SectionId) => string;
}> = ({ title, hint, sections, separatorBefore = [], page, toMountPath, mountId, sectionLabel }) => {
  const separatorBeforeSet = new Set(separatorBefore);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-0.5 px-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <SettingsNavScopeHint hint={hint} label={title} />
      </div>
      {sections.map((sec) => {
        const isActive = page.activeSection === sec.id;
        return (
          <React.Fragment key={sec.id}>
            {separatorBeforeSet.has(sec.id) ? (
              <div className="my-0.5 border-t border-slate-200/90" role="separator" />
            ) : null}
            <NavLink
              to={toMountPath(buildSettingsSectionRelativePath(sec.id, mountId))}
              className={cn(
                WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
                isActive
                  ? cn(WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS, getSettingsSectionNavActiveClass(sec.id))
                  : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <SettingsSectionIcon sectionId={sec.id} />
              <span className="truncate">{sectionLabel(sec.id)}</span>
            </NavLink>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const SettingsNav: React.FC<SettingsNavProps> = ({ page }) => {
  const t = useCultureT();
  const { mountId, toMountPath } = usePlatformMount();
  const sectionLabel = (id: SectionId) => t(settingsSectionLabelKey(id));

  return (
    <div
      className={cn(
        'hidden h-full min-h-0 shrink-0 self-stretch overflow-y-auto border-e border-slate-200 bg-slate-50 p-4 md:block',
        WORKSPACE_SECTION_NAV_WIDTH_CLASS,
      )}
    >
      <div className="space-y-3">
        <NavSectionGroup
          title={t(settingsScopeTitleKey('platform'))}
          hint={t(settingsScopeHintKey('platform'))}
          sections={SETTINGS_SIDEBAR_PLATFORM_SECTIONS}
          separatorBefore={PLATFORM_WIDE_NAV_SEPARATORS}
          page={page}
          toMountPath={toMountPath}
          mountId={mountId}
          sectionLabel={sectionLabel}
        />

        <div className="border-t border-slate-200/90" role="separator" />

        <NavSectionGroup
          title={t(settingsScopeTitleKey('node'))}
          hint={t(settingsScopeHintKey('node'))}
          sections={SETTINGS_SIDEBAR_NODE_SECTIONS}
          separatorBefore={NODE_NAV_SEPARATORS}
          page={page}
          toMountPath={toMountPath}
          mountId={mountId}
          sectionLabel={sectionLabel}
        />
      </div>
    </div>
  );
};
