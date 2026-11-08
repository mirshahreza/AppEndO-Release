import React from 'react';
import { Save } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import {
  AppButton,
  AppCultureButton,
  SHADOW_RAISED,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { useSettingsFormT } from '../hooks/useSettingsFormT';
import { SETTINGS_PANEL_PADDING_X_CLASS } from './form/SettingsFormPrimitives';

type SettingsStickySaveBarProps = {
  page: SettingsPageModel;
};

export const SettingsStickySaveBar: React.FC<SettingsStickySaveBarProps> = ({ page }) => {
  const culture = useOptionalCulture();
  const t = useSettingsFormT();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );

  if (!page.isDirty) {
    return null;
  }

  const saveLabel = page.isSaving || page.saveStatus === 'saving'
    ? label('actions.saving')
    : page.saveStatus === 'saved'
      ? label('actions.saved')
      : label('actions.saveChanges');

  return (
    <div
      className={cn(
        'z-30 w-full shrink-0 border-t border-slate-200 bg-white py-3',
        SETTINGS_PANEL_PADDING_X_CLASS,
        SHADOW_RAISED,
      )}
      role="region"
      aria-label={t('settings.forms.logs.unsavedTitle')}
    >
      <div className="flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-slate-800">
            {t('settings.forms.logs.unsavedTitle')}
          </p>
          <p className="text-xs font-medium text-slate-600">
            {t('settings.forms.logs.unsavedHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AppButton
            type="button"
            intent="cancel"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={page.discardDraft}
            disabled={page.isSaving}
          >
            {label('actions.cancel')}
          </AppButton>
          <AppCultureButton
            intent="primary"
            onClick={() => void page.handleSave()}
            disabled={page.isSaving}
          >
            <Save className="h-3.5 w-3.5 shrink-0" />
            {saveLabel}
          </AppCultureButton>
        </div>
      </div>
    </div>
  );
};
