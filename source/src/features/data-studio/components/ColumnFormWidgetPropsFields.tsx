import React from 'react';
import type { ColumnFormWidget, ColumnFormWidgetProps } from '../../../shared/api/contracts/data-api';
import { COLUMN_CODE_LANGUAGE_OPTIONS } from '../../../shared/api/contracts/data-api';
import { FormField, UiInput, UiSelect } from '../../../shared/ui';

export type ColumnFormWidgetPropsFieldsProps = {
  widget: ColumnFormWidget | '';
  value: ColumnFormWidgetProps;
  onChange: (next: ColumnFormWidgetProps) => void;
};

const ROW_CLASS = 'grid w-full min-w-0 grid-cols-2 gap-3';
const HALF_CLASS = 'col-span-1 min-w-0 w-full';
const FULL_CLASS = 'col-span-2 min-w-0 w-full';
const CONTROL_CLASS = 'block w-full min-w-0';

const parseOptionalNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const NumberField: React.FC<{
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  ariaLabel: string;
  className?: string;
}> = ({ label, hint, value, onChange, ariaLabel, className }) => (
  <FormField label={label} hint={hint} className={className ?? HALF_CLASS}>
    <UiInput
      size="sm"
      type="number"
      aiAssist={false}
      className={CONTROL_CLASS}
      value={value === undefined ? '' : String(value)}
      onChange={(event) => onChange(parseOptionalNumber(event.target.value))}
      ariaLabel={ariaLabel}
    />
  </FormField>
);

/** Extra widget props only — Placeholder lives on the Display Name row in the dialog. */
export const ColumnFormWidgetPropsFields: React.FC<ColumnFormWidgetPropsFieldsProps> = ({
  widget,
  value,
  onChange,
}) => {
  if (!widget) {
    return null;
  }

  const patch = (partial: Partial<ColumnFormWidgetProps>) => {
    onChange({ ...value, ...partial });
  };

  if (widget === 'number' || widget === 'currency') {
    return (
      <div className={ROW_CLASS}>
        <NumberField
          label="Min"
          value={value.min}
          onChange={(min) => patch({ min })}
          ariaLabel="Minimum value"
        />
        <NumberField
          label="Max"
          value={value.max}
          onChange={(max) => patch({ max })}
          ariaLabel="Maximum value"
        />
        <NumberField
          label="Step"
          value={value.step}
          onChange={(step) => patch({ step })}
          ariaLabel="Step value"
        />
        {widget === 'currency' ? (
          <FormField label="Currency" className={HALF_CLASS}>
            <UiInput
              size="sm"
              aiAssist={false}
              className={CONTROL_CLASS}
              value={value.currencyCode ?? ''}
              onChange={(event) => patch({ currencyCode: event.target.value })}
              placeholder="USD"
              ariaLabel="Currency code"
            />
          </FormField>
        ) : (
          <div className={HALF_CLASS} aria-hidden="true" />
        )}
      </div>
    );
  }

  if (widget === 'code') {
    return (
      <div className={ROW_CLASS}>
        <FormField
          label="Language"
          hint="Syntax model used by the code editor."
          className={HALF_CLASS}
        >
          <UiSelect
            size="sm"
            className={CONTROL_CLASS}
            value={value.language ?? 'plaintext'}
            onChange={(event) => patch({ language: event.target.value })}
            ariaLabel="Code language"
          >
            {COLUMN_CODE_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </FormField>
        <NumberField
          label="Rows"
          value={value.rows}
          onChange={(rows) => patch({ rows })}
          ariaLabel="Editor rows"
        />
      </div>
    );
  }

  if (
    widget === 'text'
    || widget === 'password'
    || widget === 'email'
    || widget === 'url'
    || widget === 'phone'
  ) {
    return (
      <div className={ROW_CLASS}>
        <NumberField
          label="Max length"
          value={value.maxLength}
          onChange={(maxLength) => patch({ maxLength })}
          ariaLabel="Maximum length"
        />
        <div className={HALF_CLASS} aria-hidden="true" />
      </div>
    );
  }

  if (
    widget === 'multiline'
    || widget === 'html'
    || widget === 'markdown'
    || widget === 'json'
  ) {
    return (
      <div className={ROW_CLASS}>
        <NumberField
          label="Rows"
          value={value.rows}
          onChange={(rows) => patch({ rows })}
          ariaLabel="Textarea rows"
        />
        {widget === 'multiline' ? (
          <NumberField
            label="Max length"
            value={value.maxLength}
            onChange={(maxLength) => patch({ maxLength })}
            ariaLabel="Maximum length"
          />
        ) : (
          <div className={HALF_CLASS} aria-hidden="true" />
        )}
      </div>
    );
  }

  if (widget === 'select' || widget === 'dropdown' || widget === 'tags') {
    return (
      <div className={ROW_CLASS}>
        <FormField
          label="Options"
          hint="One value per line, or comma-separated."
          className={widget === 'tags' ? HALF_CLASS : FULL_CLASS}
        >
          <UiInput
            size="sm"
            aiAssist={false}
            className={CONTROL_CLASS}
            value={value.optionsText ?? ''}
            onChange={(event) => patch({ optionsText: event.target.value })}
            placeholder="draft, published, archived"
            ariaLabel="Static options"
          />
        </FormField>
        {widget === 'tags' ? (
          <NumberField
            label="Max tags"
            value={value.maxTags}
            onChange={(maxTags) => patch({ maxTags })}
            ariaLabel="Maximum tags"
          />
        ) : null}
      </div>
    );
  }

  if (widget === 'image' || widget === 'file') {
    return (
      <div className={ROW_CLASS}>
        <FormField
          label="Accept"
          hint="MIME or extension filter, e.g. image/* or .pdf,.docx"
          className={HALF_CLASS}
        >
          <UiInput
            size="sm"
            aiAssist={false}
            className={CONTROL_CLASS}
            value={value.accept ?? ''}
            onChange={(event) => patch({ accept: event.target.value })}
            placeholder={widget === 'image' ? 'image/*' : '.pdf,.docx'}
            ariaLabel="Accepted file types"
          />
        </FormField>
        <NumberField
          label="Max MB"
          value={value.maxSizeMb}
          onChange={(maxSizeMb) => patch({ maxSizeMb })}
          ariaLabel="Maximum file size in megabytes"
        />
      </div>
    );
  }

  return null;
};
