import React from 'react';
import { AppRouteLoading } from '../../../../components/AppRouteLoading';
import type {
  PlatformRouteLoadingConfig,
  RouteLoadingLogoSize,
  RouteLoadingProgressStyle,
  RouteLoadingStackOrder,
} from '../../../../shared/api/contracts/routeLoading/schema';
import { AppButton, QueryErrorPanel, UiSelect } from '../../../../shared/ui';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { getSettingsTypography } from '../../settingsSectionTypography';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsField,
  SettingsFormGroup,
  SettingsToggleField,
} from '../form/SettingsFormPrimitives';
import type { RouteLoadingSettingsSectionModel } from './useRouteLoadingSettingsSection';

type RouteLoadingSettingsSectionProps = {
  page: RouteLoadingSettingsSectionModel;
};

const LOGO_SIZE_OPTIONS: RouteLoadingLogoSize[] = ['compact', 'default', 'large', 'xlarge'];
const PROGRESS_OPTIONS: RouteLoadingProgressStyle[] = ['ecg', 'simple-line', 'none'];
const STACK_ORDER_OPTIONS: RouteLoadingStackOrder[] = ['logo-first', 'activity-first'];

function patchEmbedded(
  config: PlatformRouteLoadingConfig,
  patch: NonNullable<PlatformRouteLoadingConfig['embedded']>,
): PlatformRouteLoadingConfig {
  return {
    ...config,
    embedded: {
      ...config.embedded,
      ...patch,
    },
  };
}

export const RouteLoadingSettingsSection: React.FC<RouteLoadingSettingsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('route-loading');
  const config = page.draftConfig;

  if (page.isLoading) {
    return <div className={typo.loadingText}>{t('settings.forms.routeLoading.loading')}</div>;
  }

  if (page.isError && page.loadError) {
    return (
      <QueryErrorPanel
        message={t('settings.forms.routeLoading.loadError')}
        detail={page.loadError}
        onRetry={() => void page.retryLoad()}
      />
    );
  }

  if (!config || !page.previewExperience) {
    return null;
  }

  const update = (patch: Partial<PlatformRouteLoadingConfig>) => {
    page.updateDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup title={t('settings.forms.routeLoading.previewTitle')} sectionId="route-loading">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <AppButton
            size="sm"
            intent={page.previewVariant === 'fullscreen' ? 'primary' : 'utility'}
            onClick={() => page.setPreviewVariant('fullscreen')}
          >
            {t('settings.forms.routeLoading.previewFullscreen')}
          </AppButton>
          <AppButton
            size="sm"
            intent={page.previewVariant === 'embedded' ? 'primary' : 'utility'}
            onClick={() => page.setPreviewVariant('embedded')}
          >
            {t('settings.forms.routeLoading.previewEmbedded')}
          </AppButton>
        </div>
        <div
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
          style={{ minHeight: page.previewVariant === 'fullscreen' ? '14rem' : '10rem' }}
        >
          <AppRouteLoading
            variant={page.previewVariant}
            className={page.previewVariant === 'fullscreen' ? '!min-h-[14rem] !py-6' : undefined}
            experienceOverride={page.previewExperience}
          />
        </div>
      </SettingsFormGroup>

      <SettingsFormGroup title={t('settings.forms.routeLoading.fullscreenTitle')} sectionId="route-loading" divided>
        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsToggleField
            id="route-loading-show-logo"
            checked={config.showLogo}
            onChange={(checked) => update({ showLogo: checked })}
            title={t('settings.forms.routeLoading.showLogo')}
            description={t('settings.forms.routeLoading.showLogoHint')}
          />
          <SettingsField label={t('settings.forms.routeLoading.logoSize')} htmlFor="route-loading-logo-size">
            <UiSelect
              id="route-loading-logo-size"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.logoSize}
              disabled={!config.showLogo}
              onChange={(event) => {
                const next = event.target.value;
                if (LOGO_SIZE_OPTIONS.includes(next as RouteLoadingLogoSize)) {
                  update({ logoSize: next as RouteLoadingLogoSize });
                }
              }}
            >
              {LOGO_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.forms.routeLoading.logoSize.${value}`)}
                </option>
              ))}
            </UiSelect>
          </SettingsField>
          <SettingsToggleField
            id="route-loading-logo-glow"
            checked={config.logoGlow}
            onChange={(checked) => update({ logoGlow: checked })}
            title={t('settings.forms.routeLoading.logoGlow')}
            disabled={!config.showLogo}
          />
          <SettingsToggleField
            id="route-loading-logo-breathe"
            checked={config.logoBreathe}
            onChange={(checked) => update({ logoBreathe: checked })}
            title={t('settings.forms.routeLoading.logoBreathe')}
            disabled={!config.showLogo}
          />
          <SettingsField label={t('settings.forms.routeLoading.stackOrder')} htmlFor="route-loading-stack-order">
            <UiSelect
              id="route-loading-stack-order"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.stackOrder}
              onChange={(event) => {
                const next = event.target.value;
                if (STACK_ORDER_OPTIONS.includes(next as RouteLoadingStackOrder)) {
                  update({ stackOrder: next as RouteLoadingStackOrder });
                }
              }}
            >
              {STACK_ORDER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.forms.routeLoading.stackOrder.${value}`)}
                </option>
              ))}
            </UiSelect>
          </SettingsField>
          <SettingsField label={t('settings.forms.routeLoading.progressStyle')} htmlFor="route-loading-progress">
            <UiSelect
              id="route-loading-progress"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.progressStyle}
              onChange={(event) => {
                const next = event.target.value;
                if (PROGRESS_OPTIONS.includes(next as RouteLoadingProgressStyle)) {
                  update({ progressStyle: next as RouteLoadingProgressStyle });
                }
              }}
            >
              {PROGRESS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.forms.routeLoading.progressStyle.${value}`)}
                </option>
              ))}
            </UiSelect>
          </SettingsField>
        </div>
      </SettingsFormGroup>

      <SettingsFormGroup title={t('settings.forms.routeLoading.embeddedTitle')} sectionId="route-loading" divided>
        <p className="text-xs text-slate-500">{t('settings.forms.routeLoading.embeddedIntro')}</p>
        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsField label={t('settings.forms.routeLoading.logoSize')} htmlFor="route-loading-embedded-logo-size">
            <UiSelect
              id="route-loading-embedded-logo-size"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.embedded?.logoSize ?? config.logoSize}
              onChange={(event) => {
                const next = event.target.value;
                if (LOGO_SIZE_OPTIONS.includes(next as RouteLoadingLogoSize)) {
                  page.updateDraft((current) => patchEmbedded(current, { logoSize: next as RouteLoadingLogoSize }));
                }
              }}
            >
              {LOGO_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.forms.routeLoading.logoSize.${value}`)}
                </option>
              ))}
            </UiSelect>
          </SettingsField>
          <SettingsField label={t('settings.forms.routeLoading.progressStyle')} htmlFor="route-loading-embedded-progress">
            <UiSelect
              id="route-loading-embedded-progress"
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.embedded?.progressStyle ?? config.progressStyle}
              onChange={(event) => {
                const next = event.target.value;
                if (PROGRESS_OPTIONS.includes(next as RouteLoadingProgressStyle)) {
                  page.updateDraft((current) => patchEmbedded(current, { progressStyle: next as RouteLoadingProgressStyle }));
                }
              }}
            >
              {PROGRESS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.forms.routeLoading.progressStyle.${value}`)}
                </option>
              ))}
            </UiSelect>
          </SettingsField>
        </div>
      </SettingsFormGroup>

      {page.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{page.formError}</div>
      ) : null}
    </div>
  );
};
