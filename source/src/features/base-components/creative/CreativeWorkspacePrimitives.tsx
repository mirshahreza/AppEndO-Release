import * as React from 'react';
import { cn } from '../../../lib/utils';
import { FormField, FormSection, UiSelect } from '../../../shared/ui';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import {
  BaseComponentsConfigToolbarControls,
  BaseComponentsResetButton,
} from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import type { SectionId } from '../types';

export function CreativeSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={String(value)}
        ariaLabel={label}
        onChange={(event) => {
          const next = options.find((option) => String(option) === event.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </UiSelect>
    </FormField>
  );
}

export function CreativeCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <BaseComponentsConfigBoolField
      label={label}
      checked={checked}
      onChange={onChange}
      ariaLabel={label}
    />
  );
}

export function CreativeWorkspace({
  sectionId,
  json,
  onReset,
  primaryControls,
  fallbackControls,
  children,
  previewClassName,
}: {
  sectionId: SectionId;
  json: string;
  onReset: () => void;
  primaryControls: React.ReactNode;
  fallbackControls: React.ReactNode;
  children: React.ReactNode;
  previewClassName?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId={sectionId} json={json}>
          <BaseComponentsResetButton onClick={onReset} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Production configuration" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>{primaryControls}</div>
            </FormSection>
            <FormSection title="Compatibility and fallback" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>{fallbackControls}</div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId={sectionId}>
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, previewClassName)}>{children}</div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
}

export function CreativeDiagnostics({
  entries,
}: {
  entries: readonly { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs sm:grid-cols-4">
      {entries.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="font-bold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 truncate font-semibold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
