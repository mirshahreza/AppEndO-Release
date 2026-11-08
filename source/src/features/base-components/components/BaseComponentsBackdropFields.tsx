import React from 'react';
import { FormField, UiSelect } from '../../../shared/ui';
import type {
  DialogBackdropBlur,
  DialogBackdropTint,
  DialogBackdropTransparency,
} from '../../../shared/ui/surfaceClasses';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';

export const BASE_COMPONENTS_BACKDROP_TINT_OPTIONS: readonly DialogBackdropTint[] = [
  'faint',
  'light',
  'medium',
];

export const BASE_COMPONENTS_BACKDROP_BLUR_OPTIONS: readonly DialogBackdropBlur[] = [
  'soft',
  'default',
];

export const BASE_COMPONENTS_BACKDROP_TRANSPARENCY_OPTIONS: readonly DialogBackdropTransparency[] = [
  'opaque',
  'soft',
  'clear',
];

const TINT_LABEL: Record<DialogBackdropTint, string> = {
  faint: 'faint',
  light: 'light',
  medium: 'medium',
};

const BLUR_LABEL: Record<DialogBackdropBlur, string> = {
  soft: 'soft',
  default: 'default',
};

const TRANSPARENCY_LABEL: Record<DialogBackdropTransparency, string> = {
  opaque: 'opaque',
  soft: 'soft',
  clear: 'clear',
};

type BaseComponentsBackdropFieldsProps = {
  tint: DialogBackdropTint;
  blur: DialogBackdropBlur;
  transparency: DialogBackdropTransparency;
  onTintChange: (tint: DialogBackdropTint) => void;
  onBlurChange: (blur: DialogBackdropBlur) => void;
  onTransparencyChange: (transparency: DialogBackdropTransparency) => void;
};

export const BaseComponentsBackdropFields: React.FC<BaseComponentsBackdropFieldsProps> = ({
  tint,
  blur,
  transparency,
  onTintChange,
  onBlurChange,
  onTransparencyChange,
}) => (
  <>
    <FormField label="Dim" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={tint}
        onChange={(event) => {
          const value = event.target.value as DialogBackdropTint;
          if (BASE_COMPONENTS_BACKDROP_TINT_OPTIONS.includes(value)) {
            onTintChange(value);
          }
        }}
        ariaLabel="Backdrop dim"
      >
        {BASE_COMPONENTS_BACKDROP_TINT_OPTIONS.map((value) => (
          <option key={value} value={value}>{TINT_LABEL[value]}</option>
        ))}
      </UiSelect>
    </FormField>
    <FormField label="Blur" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={blur}
        onChange={(event) => {
          const value = event.target.value as DialogBackdropBlur;
          if (BASE_COMPONENTS_BACKDROP_BLUR_OPTIONS.includes(value)) {
            onBlurChange(value);
          }
        }}
        ariaLabel="Backdrop blur"
      >
        {BASE_COMPONENTS_BACKDROP_BLUR_OPTIONS.map((value) => (
          <option key={value} value={value}>{BLUR_LABEL[value]}</option>
        ))}
      </UiSelect>
    </FormField>
    <FormField label="Transparency" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={transparency}
        onChange={(event) => {
          const value = event.target.value as DialogBackdropTransparency;
          if (BASE_COMPONENTS_BACKDROP_TRANSPARENCY_OPTIONS.includes(value)) {
            onTransparencyChange(value);
          }
        }}
        ariaLabel="Backdrop transparency"
      >
        {BASE_COMPONENTS_BACKDROP_TRANSPARENCY_OPTIONS.map((value) => (
          <option key={value} value={value}>{TRANSPARENCY_LABEL[value]}</option>
        ))}
      </UiSelect>
    </FormField>
  </>
);
