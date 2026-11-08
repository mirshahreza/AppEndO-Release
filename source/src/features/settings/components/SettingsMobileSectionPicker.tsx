import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { useCultureT } from '../../../core/culture/CultureContext';
import { settingsScopeTitleKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { buildSettingsSectionRelativePath } from '../settingsRoute';
import { SETTINGS_SIDEBAR_NODE_SECTIONS, SETTINGS_SIDEBAR_PLATFORM_SECTIONS } from '../settingsSections';
import { UiSelect } from '../../../shared/ui/HeroFieldControls';

type SettingsMobileSectionPickerProps = {
  page: SettingsPageModel;
};

export const SettingsMobileSectionPicker: React.FC<SettingsMobileSectionPickerProps> = ({ page }) => {
  const t = useCultureT();
  const navigate = useNavigate();
  const { mountId, toMountPath } = usePlatformMount();

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 md:hidden">
      <label className="flex flex-col gap-[2px] ps-[4px]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {t('settings.mobileSectionLabel')}
        </span>
        <UiSelect
          size="sm"
          value={page.activeSection}
          onChange={(event) => {
            const nextSection = event.target.value as SettingsPageModel['activeSection'];
            navigate(toMountPath(buildSettingsSectionRelativePath(nextSection, mountId)));
          }}
          className="w-full"
          ariaLabel={t('settings.mobileSectionAria')}
        >
          <optgroup label={t(settingsScopeTitleKey('platform'))}>
            {SETTINGS_SIDEBAR_PLATFORM_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={t(settingsScopeTitleKey('node'))}>
            {SETTINGS_SIDEBAR_NODE_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </optgroup>
        </UiSelect>
      </label>
    </div>
  );
};
