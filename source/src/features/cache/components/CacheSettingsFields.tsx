import React from 'react';
import { Database, MemoryStick } from 'lucide-react';
import { AppButton, UiInput } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useSettingsFormT } from '../../settings/hooks/useSettingsFormT';
import { SETTINGS_CONTROL_CLASS, SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS } from '../../settings/components/form/SettingsFormPrimitives';
import { getSettingsTypography } from '../../settings/settingsSectionTypography';
import type { CacheSettingsFormState } from '../cacheSettingsForm';

const cacheTypography = getSettingsTypography('cache');

type CacheSettingsFieldsProps = {
  form: CacheSettingsFormState;
  onFormChange: (next: CacheSettingsFormState) => void;
};

export const CacheSettingsFields: React.FC<CacheSettingsFieldsProps> = ({ form, onFormChange }) => {
  const t = useSettingsFormT();
  const isRedis = form.driver === 'redis';

  const storageOptions = [
    { value: 'memory', label: t('settings.forms.cache.driver.memory'), icon: MemoryStick },
    { value: 'redis', label: t('settings.forms.cache.driver.redis'), icon: Database },
  ] as const;

  return (
    <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
      <div className="flex flex-col gap-[2px] sm:col-span-2">
        <span className={cacheTypography.fieldLabel}>{t('settings.forms.cache.storage')}</span>
        <div
          className="mt-[2px] flex flex-row flex-wrap gap-2"
          role="group"
          aria-label={t('settings.forms.cache.storageAria')}
        >
          {storageOptions.map((option) => {
            const Icon = option.icon;
            const selected = form.driver === option.value;

            return (
              <AppButton
                key={option.value}
                type="button"
                intent={selected ? 'toggle-on' : 'cancel'}
                size="sm"
                aria-pressed={selected}
                onClick={() => onFormChange({
                  ...form,
                  driver: option.value === 'redis' ? 'redis' : 'memory',
                })}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </AppButton>
            );
          })}
        </div>
      </div>

      <p className={cn('sm:col-span-2 -mt-1', cacheTypography.fieldHint)}>
        {t('settings.forms.cache.storageInfo')}
      </p>

      <div className="flex flex-col gap-[2px]">
        <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.defaultTtl')}</label>
        <UiInput
          value={form.defaultTtl}
          onChange={(event) => onFormChange({ ...form, defaultTtl: event.target.value })}
          inputMode="numeric"
          ariaLabel={t('settings.forms.cache.defaultTtl')}
          className={SETTINGS_CONTROL_CLASS}
          size="sm"
        />
      </div>

      <div className="flex flex-col gap-[2px]">
        <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.maxItems')}</label>
        <UiInput
          value={form.maxItems}
          onChange={(event) => onFormChange({ ...form, maxItems: event.target.value })}
          inputMode="numeric"
          ariaLabel={t('settings.forms.cache.maxItems')}
          className={SETTINGS_CONTROL_CLASS}
          size="sm"
          disabled={isRedis}
        />
      </div>

      {isRedis && (
        <>
          <div className="flex flex-col gap-[2px]">
            <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.redisHost')}</label>
            <UiInput
              value={form.redisHost}
              onChange={(event) => onFormChange({ ...form, redisHost: event.target.value })}
              placeholder="127.0.0.1"
              ariaLabel={t('settings.forms.cache.redisHost')}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.redisPort')}</label>
            <UiInput
              value={form.redisPort}
              onChange={(event) => onFormChange({ ...form, redisPort: event.target.value })}
              inputMode="numeric"
              placeholder="6379"
              ariaLabel={t('settings.forms.cache.redisPort')}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.redisDbIndex')}</label>
            <UiInput
              value={form.redisDbIndex}
              onChange={(event) => onFormChange({ ...form, redisDbIndex: event.target.value })}
              inputMode="numeric"
              placeholder="0"
              ariaLabel={t('settings.forms.cache.redisDbIndex')}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={cacheTypography.fieldLabel}>{t('settings.forms.cache.redisPassword')}</label>
            <UiInput
              type="password"
              value={form.redisPassword}
              onChange={(event) => onFormChange({ ...form, redisPassword: event.target.value })}
              placeholder={t('settings.forms.cache.redisPasswordPlaceholder')}
              ariaLabel={t('settings.forms.cache.redisPassword')}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </div>
        </>
      )}
    </div>
  );
};
