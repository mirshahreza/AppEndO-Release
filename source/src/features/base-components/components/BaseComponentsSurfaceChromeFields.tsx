import React from 'react';
import { FormField, FormSection, UiInput, UiSelect } from '../../../shared/ui';
import { COLOR_PICKER_DEFAULT_HEX } from '../../../shared/ui/surfaceClasses';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import type { SurfaceChromeColorSource } from '../../../shared/ui/surfaceChromeClasses';
import {
  BASE_COMPONENTS_CONFIG_CHROME_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_CHROME_HEX_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_CHROME_ROW_CLASS,
  BASE_COMPONENTS_CONFIG_CHROME_SELECT_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
} from '../baseComponentsConfiguratorLayout';
import { markBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';

export const BASE_COMPONENTS_SURFACE_CHROME_TONE_OPTIONS: AppSurfaceBoxTone[] = [
  'slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose',
];

export type BaseComponentsSurfaceChromeConfig = {
  colorSource: SurfaceChromeColorSource;
  tone: AppSurfaceBoxTone;
  customColorHex: string;
};

export const BASE_COMPONENTS_SURFACE_CHROME_DEFAULT: BaseComponentsSurfaceChromeConfig = {
  colorSource: 'accent',
  tone: 'cyan',
  customColorHex: COLOR_PICKER_DEFAULT_HEX,
};

type BaseComponentsSurfaceChromeFieldsProps = {
  config: BaseComponentsSurfaceChromeConfig;
  onChange: (patch: Partial<BaseComponentsSurfaceChromeConfig>) => void;
};

export const BaseComponentsSurfaceChromeFields: React.FC<BaseComponentsSurfaceChromeFieldsProps> = ({
  config,
  onChange,
}) => (
  <div className={BASE_COMPONENTS_CONFIG_CHROME_ROW_CLASS}>
    <FormField label="Color source" className={BASE_COMPONENTS_CONFIG_CHROME_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_CHROME_SELECT_CLASS}
        value={config.colorSource}
        onChange={(event) => {
          const colorSource = event.target.value as SurfaceChromeColorSource;
          if (colorSource === 'accent' || colorSource === 'tone' || colorSource === 'custom') {
            onChange({ colorSource });
          }
        }}
        ariaLabel="Color source"
      >
        <option value="accent">accent theme</option>
        <option value="tone">preset tone</option>
        <option value="custom">custom hex</option>
      </UiSelect>
    </FormField>

    {config.colorSource === 'tone' ? (
      <FormField label="Tone" className={BASE_COMPONENTS_CONFIG_CHROME_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_CHROME_SELECT_CLASS}
          value={config.tone}
          onChange={(event) => {
            const tone = event.target.value as AppSurfaceBoxTone;
            if (BASE_COMPONENTS_SURFACE_CHROME_TONE_OPTIONS.includes(tone)) {
              onChange({ tone });
            }
          }}
          ariaLabel="Surface tone"
        >
          {BASE_COMPONENTS_SURFACE_CHROME_TONE_OPTIONS.map((tone) => (
            <option key={tone} value={tone}>{tone}</option>
          ))}
        </UiSelect>
      </FormField>
    ) : null}

    {config.colorSource === 'custom' ? (
      <FormField label="Custom color" className={BASE_COMPONENTS_CONFIG_CHROME_FIELD_CLASS} reserveHintSlot={false}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={config.customColorHex}
            onChange={(event) => {
              onChange({ customColorHex: event.target.value.toUpperCase() });
            }}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
            aria-label="Custom surface color"
          />
          <UiInput
            size="sm"
            autoDir={false}
            className={BASE_COMPONENTS_CONFIG_CHROME_HEX_INPUT_CLASS}
            value={config.customColorHex}
            onChange={(event) => {
              onChange({ customColorHex: event.target.value });
            }}
            ariaLabel="Custom color hex"
          />
        </div>
      </FormField>
    ) : null}
  </div>
);

type BaseComponentsSurfaceChromeSectionProps = BaseComponentsSurfaceChromeFieldsProps & {
  tone?: AppSurfaceBoxTone;
  divided?: boolean;
};

export const BaseComponentsSurfaceChromeSection: React.FC<BaseComponentsSurfaceChromeSectionProps> = ({
  config,
  onChange,
  tone = BASE_COMPONENTS_CONFIG_SECTION_TONE,
  divided = false,
}) => (
  <FormSection title="Surface chrome" tone={tone} divided={divided}>
    <BaseComponentsSurfaceChromeFields config={config} onChange={onChange} />
  </FormSection>
);
markBaseComponentsConfigSectionSource(BaseComponentsSurfaceChromeSection);
