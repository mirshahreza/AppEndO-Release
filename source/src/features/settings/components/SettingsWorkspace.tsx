import React from 'react';
import { useSettingsPage } from '../hooks/useSettingsPage';
import { SettingsPageView } from './SettingsPageView';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';

export const SettingsWorkspace: React.FC = () => {
  const page = useSettingsPage();

  usePublishAiPageContext({ activeSectionId: page.activeSection });

  return <SettingsPageView page={page} />;
};
