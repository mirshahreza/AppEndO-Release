import React, { useEffect, useMemo } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { PlatformCulturePack } from '../../../../shared/api/contracts/platform/cultures';
import { loadCultureFonts } from '../../../../core/culture/cultureFontLoader';
import { isWebFontId } from '../../../../core/culture/platformWebFontRegistry';
import { AppButton, CreateEditModalShell, UiAutocomplete, UiSelect } from '../../../../shared/ui';
import { cn } from '../../../../lib/utils';
import { SETTINGS_FORM_GROUP_BODY_STACK_CLASS, SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS, SETTINGS_CONTROL_CLASS, SETTINGS_SUBSECTION_LABEL_CLASS, SettingsLabelInfoRow } from '../form/SettingsFormPrimitives';
import {
  applyDerivedCulturePack,
  CULTURE_CALENDAR_OPTIONS,
  CULTURE_DIRECTION_OPTIONS,
  deriveTranslationBundleId,
  resolveCultureDisplayLabel,
  resolveCultureFontOptions,
  resolveCultureTimezoneOptions,
  resolveDefaultCultureFontId,
} from './constants';
import { toDesignerAutocompleteTimezoneItems } from '../../../../shared/lib/ianaTimezoneOptions';
import { buildCultureLocaleOptions, toDesignerAutocompleteLocaleItems } from '../../../../shared/lib/cldrLocaleOptions';
import type { CultureFormMode } from './useCulturesSection';

type Props = {
  open: boolean;
  mode: CultureFormMode;
  form: PlatformCulturePack;
  formError: string | null;
  existingPackIds: string[];
  onClose: () => void;
  onChange: (next: PlatformCulturePack) => void;
  onApply: () => void;
};

const fieldClass = 'flex flex-col gap-[2px]';

export const CultureFormModal: React.FC<Props> = ({
  open,
  mode,
  form,
  formError,
  existingPackIds,
  onClose,
  onChange,
  onApply,
}) => {
  if (!open) {
    return null;
  }

  const translationBundleId = deriveTranslationBundleId(form.id, form.locale);
  const reservedIds = mode === 'create'
    ? existingPackIds
    : existingPackIds.filter((id) => id !== form.id.trim());

  const applyDerived = (next: PlatformCulturePack) => {
    onChange(applyDerivedCulturePack(next, {
      preserveId: mode === 'edit' ? form.id.trim() : undefined,
      existingIds: reservedIds,
    }));
  };

  const update = <K extends keyof PlatformCulturePack>(key: K, value: PlatformCulturePack[K]) => {
    applyDerived({ ...form, [key]: value });
  };

  const fontOptions = useMemo(
    () => resolveCultureFontOptions(translationBundleId),
    [translationBundleId],
  );

  const selectedFontId = resolveDefaultCultureFontId(translationBundleId, form.typography);
  const selectedFont = fontOptions.find((font) => font.id === selectedFontId);

  useEffect(() => {
    if (!selectedFont) {
      return;
    }

    void loadCultureFonts({
      defaultFontId: selectedFont.id,
      fonts: [selectedFont],
    });
  }, [selectedFont]);
  const timezoneItems = useMemo(
    () => toDesignerAutocompleteTimezoneItems(resolveCultureTimezoneOptions(form.defaultTimezone)),
    [form.defaultTimezone],
  );
  const localeItems = useMemo(
    () => toDesignerAutocompleteLocaleItems(buildCultureLocaleOptions(form.locale)),
    [form.locale],
  );

  const updateDefaultFont = (fontId: string) => {
    applyDerived({
      ...form,
      typography: {
        defaultFontId: fontId,
        fonts: fontOptions,
      },
    });
  };

  const displayLabel = resolveCultureDisplayLabel(form);

  return (
    <CreateEditModalShell
      size="2xl"
      title={mode === 'create' ? 'Create Culture Combination' : `Edit ${displayLabel || 'Culture'}`}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={() => { void onApply(); }}>
            {mode === 'create' ? (
              <Plus className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {mode === 'create' ? 'Add' : 'Apply'}
          </AppButton>
        </div>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        {formError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {formError}
          </div>
        ) : null}

        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <div className={cn(fieldClass, 'md:col-span-2')}>
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
              Locale
            </label>
            <UiAutocomplete
              value={form.locale}
              items={localeItems}
              onChange={(event) => update('locale', event.target.value)}
              placeholder="BCP-47 locale…"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              closeOnSelect
            />
          </div>

          <div className={fieldClass}>
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
              Calendar
            </label>
            <UiSelect
              value={form.calendar}
              onChange={(event) => update('calendar', event.target.value as PlatformCulturePack['calendar'])}
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
            >
              {CULTURE_CALENDAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>

          <div className={fieldClass}>
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
              Direction
            </label>
            <UiSelect
              value={form.direction}
              onChange={(event) => update('direction', event.target.value as PlatformCulturePack['direction'])}
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
            >
              {CULTURE_DIRECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>

          <div className={fieldClass}>
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
              Default Timezone
            </label>
            <UiAutocomplete
              value={form.defaultTimezone ?? ''}
              items={timezoneItems}
              onChange={(event) => update('defaultTimezone', event.target.value || undefined)}
              placeholder="IANA timezone…"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              closeOnSelect
            />
          </div>

          <div className={fieldClass}>
            <SettingsLabelInfoRow
              label="Default Font"
              labelInfo="Fonts are bundled with the culture — no external CDN fetch."
              infoLabel="Default Font"
              labelClassName={SETTINGS_SUBSECTION_LABEL_CLASS}
              reserveInfoSlot={false}
            />
            <UiSelect
              value={selectedFontId}
              onChange={(event) => updateDefaultFont(event.target.value)}
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
            >
              {fontOptions.map((font) => (
                <option key={font.id} value={font.id}>
                  {isWebFontId(font.id) ? `${font.label} (Uploaded)` : font.label}
                </option>
              ))}
            </UiSelect>
            {selectedFont ? (
              <div
                className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                style={{ fontFamily: `"${selectedFont.family}", ui-sans-serif, system-ui, sans-serif` }}
              >
                The quick brown fox jumps over the lazy dog.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
