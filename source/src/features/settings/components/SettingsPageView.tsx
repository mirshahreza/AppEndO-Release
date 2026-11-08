import React from 'react';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { SettingsFooter } from './SettingsFooter';
import { SettingsMobileSectionPicker } from './SettingsMobileSectionPicker';
import { SettingsNav } from './SettingsNav';
import { SystemConfigForm } from './SystemConfigForm';

type SettingsPageViewProps = {
  page: SettingsPageModel;
};

export const SettingsPageView: React.FC<SettingsPageViewProps> = ({ page }) => {
  if (page.isLoading) {
    return <div className="p-8 text-sm text-slate-500 font-mono">Loading settings runtime...</div>;
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-slate-50">
      <SettingsFooter page={page} />

      <SettingsMobileSectionPicker page={page} />

      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
        <SettingsNav page={page} />
        <SystemConfigForm page={page} />
      </div>
    </div>
  );
};
