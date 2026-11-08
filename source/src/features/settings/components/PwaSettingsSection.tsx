import React from 'react';
import { ChevronDown, Download, RefreshCw, Smartphone } from 'lucide-react';
import { AppButton, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { UiColorField } from '../../../components/ui/UiColorField';
import { mapPwaSettings } from '../../../shared/api/contracts/settings/pwaMappers';
import type { AppSettings } from '../../../shared/api/contracts/settings/types';
import { usePwaConfigQuery, pwaQueryKeys } from '../../../shared/api/queries/pwa';
import { useQueryClient } from '@tanstack/react-query';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { useSettingsFormT } from '../hooks/useSettingsFormT';
import { cn } from '../../../lib/utils';
import { applyPwaIconsFromNavigationPack } from '../../../shared/api/queries/pwaIconPack';
import { uploadPwaIcon } from '../../../shared/api/queries/pwa';
import type { PwaIconSlot } from '../../../shared/lib/pwaAssets';
import { PwaApplyIconScopeDialog, type PwaApplyIconScope } from './PwaApplyIconScopeDialog';
import { PwaIconField } from './PwaIconField';
import { PwaIconPackPickerModal } from './PwaIconPackPickerModal';
import { PwaMessagePreviewOverlay, type PwaMessagePreviewKind } from './PwaMessagePreviewOverlay';
import { buildPwaIconPatch, PWA_SLOT_FIELD, slotsForScope } from './pwaIconSlotUtils';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_FOUR_COL_GRID_GAP_CLASS,
  SETTINGS_FORM_THREE_COL_GRID_GAP_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SUBSECTION_LABEL_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
  SettingsToggleField,
  SettingsToggleTrailingRow,
} from './form/SettingsFormPrimitives';

type PwaSettingsSectionProps = {
  page: SettingsPageModel;
};

const updatePwa = (
  page: SettingsPageModel,
  patch: Partial<AppSettings['pwa']>,
) => {
  page.setDraftSettings((prev) => ({
    ...prev,
    pwa: {
      ...prev.pwa,
      ...patch,
    },
  }));
};

type ApplyScopePrompt =
  | { kind: 'library'; slot: PwaIconSlot; iconRef: string }
  | { kind: 'upload'; slot: PwaIconSlot; file: File };

export const PwaSettingsSection: React.FC<PwaSettingsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const queryClient = useQueryClient();
  const publishedPwaQuery = usePwaConfigQuery();
  const draftPwa = mapPwaSettings(page.draftSettings.pwa);
  const publishedPwa = publishedPwaQuery.data;
  const pwa = React.useMemo(
    () => mapPwaSettings({
      ...draftPwa,
      faviconUrl: draftPwa.faviconUrl || publishedPwa?.faviconUrl || '',
      icon192Url: draftPwa.icon192Url || publishedPwa?.icon192Url || '',
      icon512Url: draftPwa.icon512Url || publishedPwa?.icon512Url || '',
      maskableIcon512Url: draftPwa.maskableIcon512Url || publishedPwa?.maskableIcon512Url || '',
      iconSourceRef: draftPwa.iconSourceRef || publishedPwa?.iconSourceRef || '',
    }),
    [draftPwa, publishedPwa],
  );
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false);
  const [iconPickerTargetSlot, setIconPickerTargetSlot] = React.useState<PwaIconSlot>('192');
  const [applyScopePrompt, setApplyScopePrompt] = React.useState<ApplyScopePrompt | null>(null);
  const [messagePreviewKind, setMessagePreviewKind] = React.useState<PwaMessagePreviewKind | null>(null);
  const [iconActionError, setIconActionError] = React.useState<string | null>(null);
  const [isIconActionPending, setIsIconActionPending] = React.useState(false);
  const [iconPreviewCacheKey, setIconPreviewCacheKey] = React.useState(0);
  const pwaFieldsDisabled = !pwa.enabled;
  const installPromptFieldsDisabled = !pwa.enabled || !pwa.showInstallPrompt;

  const applyIconSet = async (iconRef: string, scope: 'all' | 'single' = 'all', slot: PwaIconSlot = '192') => {
    setIconActionError(null);
    setIsIconActionPending(true);
    try {
      const icons = await applyPwaIconsFromNavigationPack(iconRef, { themeColor: pwa.themeColor });
      updatePwa(page, buildPwaIconPatch(icons, slot, scope));
      setIconPreviewCacheKey(Date.now());
      await queryClient.invalidateQueries({ queryKey: pwaQueryKeys.config() });
    } catch (error) {
      setIconActionError((error as Error).message || t('settings.forms.pwa.iconGenerateFailed'));
      throw error;
    } finally {
      setIsIconActionPending(false);
    }
  };

  const openIconLibraryForSlot = (slot: PwaIconSlot) => {
    setIconPickerTargetSlot(slot);
    setIconPickerOpen(true);
  };

  const handleLibraryModalApply = async (iconRef: string) => {
    setIconPickerOpen(false);
    setApplyScopePrompt({ kind: 'library', slot: iconPickerTargetSlot, iconRef });
  };

  const handleSlotUploadFile = (slot: PwaIconSlot, file: File) => {
    setApplyScopePrompt({ kind: 'upload', slot, file });
  };

  const handleApplyScopeChoose = async (scope: PwaApplyIconScope) => {
    if (!applyScopePrompt) {
      return;
    }

    setIconActionError(null);
    setIsIconActionPending(true);
    try {
      if (applyScopePrompt.kind === 'library') {
        await applyIconSet(applyScopePrompt.iconRef, scope, applyScopePrompt.slot);
      } else {
        const patch: Partial<AppSettings['pwa']> = {};
        for (const targetSlot of slotsForScope(applyScopePrompt.slot, scope)) {
          const url = await uploadPwaIcon(targetSlot, applyScopePrompt.file);
          patch[PWA_SLOT_FIELD[targetSlot]] = url;
        }
        updatePwa(page, patch);
        setIconPreviewCacheKey(Date.now());
        await queryClient.invalidateQueries({ queryKey: pwaQueryKeys.config() });
      }
      setApplyScopePrompt(null);
    } catch (error) {
      setIconActionError((error as Error).message || t('settings.forms.pwa.iconUpdateFailed'));
    } finally {
      setIsIconActionPending(false);
    }
  };

  const closeApplyScopePrompt = () => {
    if (isIconActionPending) {
      return;
    }
    setApplyScopePrompt(null);
  };

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup sectionId="pwa">
        <SettingsToggleTrailingRow
          trailing={(
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <AppButton
                intent="secondary"
                size="icon-sm"
                disabled={pwaFieldsDisabled}
                aria-label={t('settings.forms.pwa.previewInstallBanner')}
                title={t('settings.forms.pwa.previewInstallBanner')}
                onClick={() => setMessagePreviewKind('install-prompt')}
              >
                <Download className="h-4 w-4" aria-hidden />
              </AppButton>
              <AppButton
                intent="secondary"
                size="icon-sm"
                disabled={pwaFieldsDisabled}
                aria-label={t('settings.forms.pwa.previewInstallReady')}
                title={t('settings.forms.pwa.previewInstallReady')}
                onClick={() => setMessagePreviewKind('install-ready')}
              >
                <Smartphone className="h-4 w-4" aria-hidden />
              </AppButton>
              <AppButton
                intent="secondary"
                size="icon-sm"
                disabled={pwaFieldsDisabled}
                aria-label={t('settings.forms.pwa.previewUpdateBanner')}
                title={t('settings.forms.pwa.previewUpdateBanner')}
                onClick={() => setMessagePreviewKind('update-available')}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </AppButton>
            </div>
          )}
        >
          <SettingsToggleField
            id="pwaEnabled"
            checked={pwa.enabled}
            onChange={(checked) => updatePwa(page, { enabled: checked })}
            title={t('settings.forms.pwa.enable')}
            titleInfo={t('settings.forms.pwa.enableInfo')}
          />
        </SettingsToggleTrailingRow>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.pwa.identity.title')}
        sectionId="pwa"
        divided
        titleInfo={t('settings.forms.pwa.identity.info')}
      >
        <SettingsDisabledFieldset disabled={pwaFieldsDisabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.pwa.appName')}>
              <UiInput
                value={pwa.name}
                onChange={(e) => updatePwa(page, { name: e.target.value })}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>

            <SettingsField
              label={t('settings.forms.pwa.shortName')}
              labelInfo={t('settings.forms.pwa.shortNameInfo')}
            >
              <UiInput
                value={pwa.shortName}
                onChange={(e) => updatePwa(page, { shortName: e.target.value })}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>

          <SettingsField label={t('settings.forms.pwa.description')} labelBand={false}>
            <UiTextarea
              value={pwa.description}
              onChange={(e) => updatePwa(page, { description: e.target.value })}
              rows={3}
              className={cn(SETTINGS_CONTROL_CLASS, 'max-w-2xl resize-y')}
              size="sm"
            />
          </SettingsField>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.pwa.lookFeel.title')}
        sectionId="pwa"
        divided
        titleInfo={t('settings.forms.pwa.lookFeel.info')}
      >
        <SettingsDisabledFieldset disabled={pwaFieldsDisabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.pwa.themeColor')}>
              <UiColorField
                value={pwa.themeColor}
                onChange={(value) => updatePwa(page, { themeColor: value })}
                ariaLabel={t('settings.forms.pwa.themeColorAria')}
              />
            </SettingsField>

            <SettingsField label={t('settings.forms.pwa.backgroundColor')}>
              <UiColorField
                value={pwa.backgroundColor}
                onChange={(value) => updatePwa(page, { backgroundColor: value })}
                ariaLabel={t('settings.forms.pwa.backgroundColorAria')}
              />
            </SettingsField>
          </div>
        </SettingsDisabledFieldset>

        {iconActionError ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {iconActionError}
          </p>
        ) : null}

        <div className={cn('mt-[5px]', pwaFieldsDisabled && 'pointer-events-none opacity-60')}>
          <div className={SETTINGS_FORM_FOUR_COL_GRID_GAP_CLASS}>
            <PwaIconField
              label={t('settings.forms.pwa.favicon32')}
              labelInfo={t('settings.forms.pwa.favicon32Info')}
              slot="32"
              pwa={pwa}
              disabled={pwaFieldsDisabled}
              isBusy={isIconActionPending}
              previewCacheKey={iconPreviewCacheKey}
              onPickFromLibrary={() => openIconLibraryForSlot('32')}
              onUploadFile={(file) => handleSlotUploadFile('32', file)}
              onChange={(url) => updatePwa(page, { faviconUrl: url })}
            />
            <PwaIconField
              label={t('settings.forms.pwa.icon192')}
              labelInfo={t('settings.forms.pwa.icon192Info')}
              slot="192"
              pwa={pwa}
              disabled={pwaFieldsDisabled}
              isBusy={isIconActionPending}
              previewCacheKey={iconPreviewCacheKey}
              onPickFromLibrary={() => openIconLibraryForSlot('192')}
              onUploadFile={(file) => handleSlotUploadFile('192', file)}
              onChange={(url) => updatePwa(page, { icon192Url: url })}
            />
            <PwaIconField
              label={t('settings.forms.pwa.icon512')}
              labelInfo={t('settings.forms.pwa.icon512Info')}
              slot="512"
              pwa={pwa}
              disabled={pwaFieldsDisabled}
              isBusy={isIconActionPending}
              previewCacheKey={iconPreviewCacheKey}
              onPickFromLibrary={() => openIconLibraryForSlot('512')}
              onUploadFile={(file) => handleSlotUploadFile('512', file)}
              onChange={(url) => updatePwa(page, { icon512Url: url })}
            />
            <PwaIconField
              label={t('settings.forms.pwa.maskable512')}
              labelInfo={t('settings.forms.pwa.maskable512Info')}
              slot="maskable"
              pwa={pwa}
              disabled={pwaFieldsDisabled}
              isBusy={isIconActionPending}
              previewCacheKey={iconPreviewCacheKey}
              onPickFromLibrary={() => openIconLibraryForSlot('maskable')}
              onUploadFile={(file) => handleSlotUploadFile('maskable', file)}
              onChange={(url) => updatePwa(page, { maskableIcon512Url: url })}
            />
          </div>
        </div>
      </SettingsFormGroup>

      <PwaIconPackPickerModal
        open={iconPickerOpen}
        initialIconRef={pwa.iconSourceRef}
        themeColor={pwa.themeColor}
        onClose={() => setIconPickerOpen(false)}
        onApply={handleLibraryModalApply}
      />

      <PwaApplyIconScopeDialog
        open={applyScopePrompt != null}
        slot={applyScopePrompt?.slot ?? '192'}
        isApplying={isIconActionPending}
        onClose={closeApplyScopePrompt}
        onChoose={(scope) => void handleApplyScopeChoose(scope)}
      />

      <SettingsFormGroup
        title={t('settings.forms.pwa.messages.title')}
        sectionId="pwa"
        divided
        titleInfo={t('settings.forms.pwa.messages.info')}
      >
        <SettingsDisabledFieldset disabled={pwaFieldsDisabled}>
          <p className={SETTINGS_SUBSECTION_LABEL_CLASS}>{t('settings.forms.pwa.installPrompt')}</p>
          <SettingsToggleField
            id="pwaShowInstallPrompt"
            checked={pwa.showInstallPrompt}
            onChange={(checked) => updatePwa(page, { showInstallPrompt: checked })}
            title={t('settings.forms.pwa.showInstallBanner')}
            titleInfo={t('settings.forms.pwa.showInstallBannerInfo')}
          />

          <SettingsDisabledFieldset disabled={installPromptFieldsDisabled}>
            <div className={SETTINGS_FORM_THREE_COL_GRID_GAP_CLASS}>
              <SettingsField label={t('settings.ui.title')}>
                <UiInput
                  value={pwa.installPromptTitle}
                  onChange={(e) => updatePwa(page, { installPromptTitle: e.target.value })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                />
              </SettingsField>

              <SettingsField
                label={t('settings.forms.pwa.installButton')}
                labelInfo={t('settings.forms.pwa.installButtonInfo')}
              >
                <UiInput
                  value={pwa.installButtonLabel}
                  onChange={(e) => updatePwa(page, { installButtonLabel: e.target.value })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                />
              </SettingsField>

              <SettingsField label={t('settings.forms.pwa.dismissButton')}>
                <UiInput
                  value={pwa.dismissButtonLabel}
                  onChange={(e) => updatePwa(page, { dismissButtonLabel: e.target.value })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                />
              </SettingsField>
            </div>

            <SettingsField label={t('settings.ui.message')} labelBand={false}>
              <UiTextarea
                value={pwa.installPromptMessage}
                onChange={(e) => updatePwa(page, { installPromptMessage: e.target.value })}
                rows={2}
                className={cn(SETTINGS_CONTROL_CLASS, 'resize-y')}
                size="sm"
              />
            </SettingsField>
          </SettingsDisabledFieldset>

          <p className={SETTINGS_SUBSECTION_LABEL_CLASS}>{t('settings.forms.pwa.readyToInstall')}</p>
          <SettingsField
            label={t('settings.ui.message')}
            labelInfo={t('settings.forms.pwa.readyToInstallInfo')}
            labelBand={false}
          >
            <UiInput
              value={pwa.installReadyMessage}
              onChange={(e) => updatePwa(page, { installReadyMessage: e.target.value })}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </SettingsField>

          <p className={SETTINGS_SUBSECTION_LABEL_CLASS}>{t('settings.forms.pwa.updateAvailable')}</p>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.ui.message')}>
              <UiInput
                value={pwa.updateAvailableMessage}
                onChange={(e) => updatePwa(page, { updateAvailableMessage: e.target.value })}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>

            <SettingsField label={t('settings.forms.pwa.reloadButton')}>
              <UiInput
                value={pwa.updateButtonLabel}
                onChange={(e) => updatePwa(page, { updateButtonLabel: e.target.value })}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <PwaMessagePreviewOverlay
        kind={messagePreviewKind}
        pwa={pwa}
        onClose={() => setMessagePreviewKind(null)}
      />

      <SettingsFormGroup
        title={t('settings.forms.pwa.launch.title')}
        sectionId="pwa"
        divided
        titleInfo={t('settings.forms.pwa.launch.info')}
      >
        <SettingsDisabledFieldset disabled={pwaFieldsDisabled}>
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200',
              'px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors',
              'hover:bg-slate-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
            )}
          >
            <span>{advancedOpen ? t('settings.ui.hideAdvanced') : t('settings.ui.showAdvanced')}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                advancedOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>

          {advancedOpen ? (
            <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
              <SettingsField label={t('settings.forms.pwa.startUrl')}>
                <UiInput
                  value={pwa.startUrl}
                  onChange={(e) => updatePwa(page, { startUrl: e.target.value })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                />
              </SettingsField>

              <SettingsField label={t('settings.forms.pwa.scope')}>
                <UiInput
                  value={pwa.scope}
                  onChange={(e) => updatePwa(page, { scope: e.target.value })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                />
              </SettingsField>

              <SettingsField label={t('settings.forms.pwa.displayMode')}>
                <UiSelect
                  value={pwa.display}
                  onChange={(e) => updatePwa(page, { display: e.target.value as AppSettings['pwa']['display'] })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                >
                  <option value="standalone">{t('settings.forms.pwa.display.standalone')}</option>
                  <option value="fullscreen">{t('settings.forms.pwa.display.fullscreen')}</option>
                  <option value="minimal-ui">{t('settings.forms.pwa.display.minimalUi')}</option>
                  <option value="browser">{t('settings.forms.pwa.display.browser')}</option>
                </UiSelect>
              </SettingsField>

              <SettingsField label={t('settings.forms.pwa.orientation')}>
                <UiSelect
                  value={pwa.orientation}
                  onChange={(e) => updatePwa(page, { orientation: e.target.value as AppSettings['pwa']['orientation'] })}
                  className={SETTINGS_CONTROL_CLASS}
                size="sm"
                >
                  <option value="any">{t('settings.forms.pwa.orientation.any')}</option>
                  <option value="natural">{t('settings.forms.pwa.orientation.natural')}</option>
                  <option value="portrait">{t('settings.forms.pwa.orientation.portrait')}</option>
                  <option value="landscape">{t('settings.forms.pwa.orientation.landscape')}</option>
                </UiSelect>
              </SettingsField>
            </div>
          ) : null}
        </SettingsDisabledFieldset>
      </SettingsFormGroup>
    </div>
  );
};
