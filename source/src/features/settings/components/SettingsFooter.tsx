import React from 'react';
import { Save } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import {
  settingsSectionDescriptionKey,
  settingsSectionLabelKey,
} from '../../../core/culture/translations/cultureKeyHelpers';
import { AppCultureButton, PageHeaderToolbar } from '../../../shared/ui';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { isDbManagedSettingsSection } from './settingsAttributes/utils';
import { hasDedicatedSettingsSave, usesStickyDirtySaveBar } from '../settingsSections';
import { SettingsSectionIcon } from '../settingsSectionIcons';
import { getSettingsTypography } from '../settingsSectionTypography';
import { SETTINGS_SECTION_DESC_CLASS } from './form/settingsFormTypography';
import { CODE_EMBEDDINGS_ENABLED } from '../../../shared/api/contracts/ai/codeEmbeddingsGate';
import { LocalEmbeddingsModelStatusBadge } from './aiModels/LocalEmbeddingsModelStatusBadge';
import { WorkspaceEmbeddingsIndexStatusBadge } from './aiModels/WorkspaceEmbeddingsIndexStatusBadge';

type SettingsFooterProps = {
  page: SettingsPageModel;
};

export const SettingsFooter: React.FC<SettingsFooterProps> = ({ page }) => {
  const culture = useOptionalCulture();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );

  const saveButtonLabel = (saveStatus: SettingsPageModel['saveStatus'], isSaving: boolean) => {
    if (isSaving || saveStatus === 'saving') return label('actions.saving');
    if (saveStatus === 'saved') return label('actions.saved');
    return label('actions.saveChanges');
  };

  const isAttributeCrudSection = isDbManagedSettingsSection(page.activeSection);
  const hideSaveFooter = isAttributeCrudSection
    || hasDedicatedSettingsSave(page.activeSection)
    || usesStickyDirtySaveBar(page.activeSection);

  const typography = getSettingsTypography(page.activeSection);

  const saveAction = !hideSaveFooter ? (
    <AppCultureButton
      intent="primary"
      onClick={() => void page.handleSave()}
      disabled={!page.isDirty || page.isSaving}
    >
      <Save className="h-3.5 w-3.5 shrink-0" />
      {saveButtonLabel(page.saveStatus, page.isSaving)}
    </AppCultureButton>
  ) : isAttributeCrudSection ? (
    <p className="text-xs text-slate-500">{label('settings.directSaveNote')}</p>
  ) : null;

  return (
    <PageHeaderToolbar
      icon={<SettingsSectionIcon sectionId={page.activeSection} className="h-4 w-4 shrink-0" />}
      title={label(settingsSectionLabelKey(page.activeSection))}
      titleClassName={typography.pageTitle}
      description={label(settingsSectionDescriptionKey(page.activeSection))}
      descriptionClassName={SETTINGS_SECTION_DESC_CLASS}
      meta={page.activeSection === 'ai-models' && CODE_EMBEDDINGS_ENABLED ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <LocalEmbeddingsModelStatusBadge />
          <WorkspaceEmbeddingsIndexStatusBadge />
        </div>
      ) : undefined}
      actions={saveAction}
    />
  );
};
