import React from 'react';
import { Braces, RotateCcw } from 'lucide-react';
import {
  AppButton,
  AppSurfaceBox,
  FormField,
  UiInput,
  UiSelect,
} from '../../../../shared/ui';
import type {
  BaseComponentMeta,
  BaseComponentOptionMeta,
  BaseComponentOptionResolution,
  BaseComponentsConfigExport,
} from '../../catalog/baseComponentOptionTypes';
import { BaseComponentsAnatomyPanel } from './BaseComponentsAnatomyPanel';
import { BaseComponentsDecisionPanel } from './BaseComponentsDecisionPanel';

export type BaseComponentsMetadataConfiguratorShellProps = {
  component: BaseComponentMeta;
  options: readonly BaseComponentOptionMeta[];
  resolution: BaseComponentOptionResolution;
  configExport: BaseComponentsConfigExport;
  onValueChange: (optionId: string, value: unknown) => void;
  onReset: () => void;
  preview: React.ReactNode;
};

const ConfiguratorControl: React.FC<{
  option: BaseComponentOptionMeta;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}> = ({ option, value, disabled, onChange }) => {
  if (option.control === 'checkbox') {
    return (
      <FormField label={option.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={Boolean(value) ? 'yes' : 'no'}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => onChange(event.target.value === 'yes')}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      </FormField>
    );
  }

  if (
    option.values &&
    ['segmented', 'select', 'combobox'].includes(option.control)
  ) {
    return (
      <FormField label={option.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={String(value)}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => {
            const match = option.values?.find(
              (candidate) => String(candidate) === event.target.value,
            );
            if (match !== undefined) onChange(match);
          }}
        >
          {option.values.map((candidate) => (
            <option key={String(candidate)} value={String(candidate)}>
              {String(candidate)}
            </option>
          ))}
        </UiSelect>
      </FormField>
    );
  }

  if (option.control === 'multi-select' && option.values) {
    const scalarValues = option.values.every(
      (candidate) => typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean',
    );
    if (scalarValues) {
      const selected = Array.isArray(value)
        ? value.map(String)
        : String(value ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
      return (
        <FormField label={option.label} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            multiple
            value={selected.join(',')}
            isDisabled={disabled}
            ariaLabel={option.label}
            placeholder="Select…"
            onChange={(event) => {
              const next = event.target.value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
              const matched = next
                .map((entry) => option.values?.find((candidate) => String(candidate) === entry))
                .filter((entry) => entry !== undefined);
              onChange(matched);
            }}
          >
            {option.values.map((candidate) => (
              <option key={String(candidate)} value={String(candidate)}>
                {String(candidate)}
              </option>
            ))}
          </UiSelect>
        </FormField>
      );
    }

    // Preset combination picker (values are arrays of allowed subsets).
    return (
      <FormField label={option.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={JSON.stringify(value)}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => {
            const match = option.values?.find(
              (candidate) => JSON.stringify(candidate) === event.target.value,
            );
            if (match !== undefined) onChange(match);
          }}
        >
          {option.values.map((candidate) => (
            <option key={JSON.stringify(candidate)} value={JSON.stringify(candidate)}>
              {Array.isArray(candidate) ? (candidate.length > 0 ? candidate.join(', ') : 'None') : String(candidate)}
            </option>
          ))}
        </UiSelect>
      </FormField>
    );
  }

  if (option.control === 'text') {
    return (
      <UiInput
        size="sm"
        label={option.label}
        value={String(value ?? '')}
        isDisabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (option.control === 'number-step' || option.control === 'range') {
    return (
      <UiInput
        size="sm"
        type="number"
        autoDir={false}
        label={option.label}
        value={typeof value === 'number' ? value : ''}
        isDisabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    );
  }

  return (
    <AppSurfaceBox layout="strip" className="text-xs text-slate-600">
      <span className="font-semibold text-slate-800">{option.label}</span>
      <span className="ms-1">
        uses the section-specific {option.control} editor
      </span>
    </AppSurfaceBox>
  );
};

export const BaseComponentsMetadataConfiguratorShell: React.FC<
  BaseComponentsMetadataConfiguratorShellProps
> = ({
  component,
  options,
  resolution,
  configExport,
  onValueChange,
  onReset,
  preview,
}) => (
  <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
    <aside className="min-h-0 space-y-2 overflow-y-auto">
      <BaseComponentsDecisionPanel component={component} />
      <BaseComponentsAnatomyPanel component={component} />
      <AppSurfaceBox
        title="Configurator"
        headerExtra={
          <AppButton intent="utility" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </AppButton>
        }
        bodyClassName="space-y-2"
      >
        {options.map((option) => {
          const state = resolution.optionState[option.id];
          if (!state?.visible) return null;
          return (
            <ConfiguratorControl
              key={option.id}
              option={option}
              value={resolution.values[option.id]}
              disabled={!state.enabled}
              onChange={(value) => onValueChange(option.id, value)}
            />
          );
        })}
      </AppSurfaceBox>
    </aside>
    <section className="min-h-0 space-y-2 overflow-y-auto">
      <div className="min-h-48 rounded-lg border border-slate-200 bg-white p-3">
        {preview}
      </div>
      <AppSurfaceBox
        title="Config export"
        headerExtra={<Braces className="h-3.5 w-3.5 text-cyan-700" aria-hidden />}
      >
        <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(configExport, null, 2)}
        </pre>
      </AppSurfaceBox>
    </section>
  </div>
);
