import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  CRUD_SET_FILTER_BAR_CONTROL_TYPES,
  CRUD_SET_FILTER_BAR_CONTROL_TYPE_LABELS,
  CRUD_SET_FILTER_OPTIONS_FROM,
  CRUD_SET_FILTER_OPTIONS_FROM_LABELS,
  crudSetFilterOptionsFrom,
  isCrudSetFilterBarControlType,
  isCrudSetFilterOptionsFrom,
  type CrudSetFilterBarFilter,
  type CrudSetFilterBarOption,
  type CrudSetFilterMatchLogic,
} from '../../domain/component-designer/crudSetSpec';
import { AppButton } from './AppButton';
import { FormField } from './FormSection';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { UiSelect } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { cn } from '../../lib/utils';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from './surfaceClasses';

export type CrudSetFilterBarFilterFieldsProps = {
  filter: CrudSetFilterBarFilter;
  onChange: (next: CrudSetFilterBarFilter) => void;
  fieldOptions?: readonly string[];
  fieldClassName?: string;
};

const emptyOption = (): CrudSetFilterBarOption => ({ value: '', label: '' });

/** Per-filter properties for the CRUD Set wizard and Base Components living sample. */
export const CrudSetFilterBarFilterFields: React.FC<CrudSetFilterBarFilterFieldsProps> = ({
  filter,
  onChange,
  fieldOptions,
  fieldClassName,
}) => {
  const patch = (partial: Partial<CrudSetFilterBarFilter>) => onChange({ ...filter, ...partial });
  const updateOption = (index: number, partial: Partial<CrudSetFilterBarOption>) => {
    patch({
      options: filter.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, ...partial } : option
      )),
    });
  };

  return (
    <>
      <FormField label="Field" required className={fieldClassName} reserveHintSlot={false}>
        {fieldOptions && fieldOptions.length > 0 ? (
          <UiSelect
            size="sm"
            value={filter.field}
            onChange={(event) => patch({ field: event.target.value })}
            ariaLabel={`Filter field for ${filter.id}`}
          >
            {fieldOptions.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </UiSelect>
        ) : (
          <UiInput
            size="sm"
            autoDir={false}
            value={filter.field}
            onChange={(event) => patch({ field: event.target.value })}
            ariaLabel={`Filter field for ${filter.id}`}
          />
        )}
      </FormField>
      <FormField label="Label" required className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={filter.label}
          onChange={(event) => patch({ label: event.target.value })}
          ariaLabel={`Filter label for ${filter.id}`}
        />
      </FormField>
      <FormField label="Control" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={filter.controlType}
          onChange={(event) => {
            const controlType = isCrudSetFilterBarControlType(event.target.value)
              ? event.target.value
              : 'select';
            patch({ controlType });
          }}
          ariaLabel={`Filter control for ${filter.id}`}
        >
          {CRUD_SET_FILTER_BAR_CONTROL_TYPES.map((type) => (
            <option key={type} value={type}>{CRUD_SET_FILTER_BAR_CONTROL_TYPE_LABELS[type]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField
        label="Options from"
        hint="Static uses the list below. Distinct values fill the control from the current rows."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          value={crudSetFilterOptionsFrom(filter)}
          onChange={(event) => patch({
            optionsFrom: isCrudSetFilterOptionsFrom(event.target.value) ? event.target.value : 'static',
          })}
          ariaLabel={`Options from for ${filter.id}`}
        >
          {CRUD_SET_FILTER_OPTIONS_FROM.map((source) => (
            <option key={source} value={source}>{CRUD_SET_FILTER_OPTIONS_FROM_LABELS[source]}</option>
          ))}
        </UiSelect>
      </FormField>
      {filter.controlType === 'checkbox-group' ? (
        <FormField label="Match logic" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            value={filter.matchLogic === 'and' ? 'and' : 'or'}
            onChange={(event) => {
              const matchLogic: CrudSetFilterMatchLogic = event.target.value === 'and' ? 'and' : 'or';
              patch({ matchLogic });
            }}
            ariaLabel={`Match logic for ${filter.id}`}
          >
            <option value="or">OR (any)</option>
            <option value="and">AND (all)</option>
          </UiSelect>
        </FormField>
      ) : null}
      {filter.controlType === 'select' ? (
        <CrudSetConfigCheckbox
          label="Multiple"
          checked={filter.multiple === true}
          fieldClassName={fieldClassName}
          onChange={(checked) => patch({ multiple: checked })}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</p>
        {filter.options.map((option, index) => (
          <div key={`${filter.id}-option-${index}`} className="flex items-center gap-2">
            <UiInput
              size="sm"
              autoDir={false}
              value={option.value}
              onChange={(event) => updateOption(index, { value: event.target.value })}
              ariaLabel={`Option value ${index + 1} for ${filter.id}`}
            />
            <UiInput
              size="sm"
              autoDir={false}
              value={option.label}
              onChange={(event) => updateOption(index, { label: event.target.value })}
              ariaLabel={`Option label ${index + 1} for ${filter.id}`}
            />
            <AppButton
              type="button"
              size="icon-sm"
              className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
              aria-label={`Remove option ${index + 1} from ${filter.label}`}
              onClick={() => patch({
                options: filter.options.filter((_, optionIndex) => optionIndex !== index),
              })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          </div>
        ))}
        <AppButton
          size="sm"
          intent="utility"
          onClick={() => patch({ options: [...filter.options, emptyOption()] })}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </AppButton>
      </div>
    </>
  );
};
