import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  crudSetColumnAfterCellKindChange,
  crudSetColumnAfterTransformChange,
  crudSetAllowedCellKindsForColumn,
  crudSetAllowedTransformsForColumn,
  crudSetCoerceColumnDisplay,
  crudSetTransformFormatHint,
  crudSetTransformFormatLabel,
  crudSetTransformFormatPlaceholder,
  crudSetTransformFormatValue,
  crudSetTransformUsesFormat,
  type CrudSetFieldMeta,
} from '../../domain/component-designer/crudSetColumnDisplayPolicy';
import {
  CRUD_SET_CELL_KIND_LABELS,
  CRUD_SET_COLUMN_CARD_ROLE_LABELS,
  CRUD_SET_COLUMN_CARD_ROLES,
  CRUD_SET_COLUMN_HIDE_BELOW_LABELS,
  CRUD_SET_COLUMN_HIDE_BELOW,
  CRUD_SET_COLUMN_PIN_LABELS,
  CRUD_SET_COLUMN_PINS,
  CRUD_SET_COLUMN_TRANSFORM_LABELS,
  CRUD_SET_CONDITIONAL_BACKGROUND_PRESETS,
  CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND,
  CRUD_SET_CONDITIONAL_WHENS,
  CRUD_SET_CONDITIONAL_WHEN_LABELS,
  CRUD_SET_FORM_PLACEMENT_LABELS,
  CRUD_SET_FORM_PLACEMENTS,
  CRUD_SET_FORM_CONTROL_LABELS,
  CRUD_SET_FORM_CONTROLS,
  CRUD_SET_IMAGE_MASKS,
  CRUD_SET_IMAGE_MASK_LABELS,
  CRUD_SET_STACK_LAYOUTS,
  CRUD_SET_STACK_LAYOUT_LABELS,
  crudSetColumnCardRole,
  crudSetColumnCellKind,
  crudSetColumnConditionalRules,
  crudSetColumnFilterable,
  crudSetColumnFormPlacement,
  crudSetColumnHideBelow,
  crudSetColumnImageMask,
  crudSetColumnIsRowHeader,
  crudSetColumnLabel,
  crudSetColumnPinned,
  crudSetColumnSecondaryField,
  crudSetColumnSortable,
  crudSetColumnStack,
  crudSetColumnTransform,
  crudSetHumanizeField,
  crudSetNormalizeConditionalBackground,
  isCrudSetColumnCardRole,
  isCrudSetColumnHideBelow,
  isCrudSetColumnPin,
  isCrudSetConditionalWhen,
  isCrudSetFormControl,
  isCrudSetFormPlacement,
  isCrudSetImageMask,
  isCrudSetStackLayout,
  type CrudSetConditionalRule,
  type CrudSetGridColumn,
} from '../../domain/component-designer/crudSetSpec';
import { AppButton } from './AppButton';
import { FormField } from './FormSection';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { UiSelect } from './HeroFieldControls';
import { UiColorPicker } from './UiColorPicker';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { cn } from '../../lib/utils';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from './surfaceClasses';

export type CrudSetColumnPropertyFieldsProps = {
  column: CrudSetGridColumn;
  columns?: readonly CrudSetGridColumn[];
  onChange: (next: CrudSetGridColumn) => void;
  fieldOptions?: readonly string[];
  fieldMeta?: CrudSetFieldMeta;
  resolveFieldMeta?: (fieldName: string) => CrudSetFieldMeta | undefined;
  fieldClassName?: string;
  columnIndex?: number;
  enableColumnLayout?: boolean;
};

const widthInputValue = (column: CrudSetGridColumn): string => (
  column.width == null ? '' : String(column.width)
);

const parseWidthInput = (raw: string): CrudSetGridColumn['width'] => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
};

const fieldNeedsCompareValue = (when: CrudSetConditionalRule['when']): boolean => (
  when === 'equals' || when === 'not-equals' || when === 'contains'
);

const emptyRule = (): CrudSetConditionalRule => ({
  when: 'equals',
  value: '',
  background: CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND,
});

const DatasetFieldControl: React.FC<{
  value: string;
  options?: readonly string[];
  ariaLabel: string;
  onChange: (next: string) => void;
  allowEmpty?: boolean;
}> = ({ value, options, ariaLabel, onChange, allowEmpty = false }) => {
  if (options && options.length > 0) {
    const merged = options.includes(value) || !value
      ? options
      : [value, ...options];
    return (
      <UiSelect
        size="sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        ariaLabel={ariaLabel}
      >
        {allowEmpty ? <option value="">None</option> : null}
        {merged.map((field) => (
          <option key={field} value={field}>{field}</option>
        ))}
      </UiSelect>
    );
  }
  return (
    <UiInput
      size="sm"
      autoDir={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      ariaLabel={ariaLabel}
    />
  );
};

/** Per-column properties for the CRUD Set wizard and Base Components living sample. */
export const CrudSetColumnPropertyFields: React.FC<CrudSetColumnPropertyFieldsProps> = ({
  column,
  columns,
  onChange,
  fieldOptions,
  fieldMeta,
  resolveFieldMeta,
  fieldClassName,
  columnIndex = 0,
  enableColumnLayout = false,
}) => {
  const patch = (partial: Partial<CrudSetGridColumn>) => onChange({ ...column, ...partial });
  const field = column.field;
  const cellKind = crudSetColumnCellKind(column);
  const transform = crudSetColumnTransform(column);
  const secondaryField = crudSetColumnSecondaryField(column);
  const rules = crudSetColumnConditionalRules(column);
  const secondaryOptions = fieldOptions?.filter((name) => name !== field);
  const meta = fieldMeta ?? resolveFieldMeta?.(field);
  const displayKinds = crudSetAllowedCellKindsForColumn(column, meta);
  const transformOptions = crudSetAllowedTransformsForColumn(column, meta);
  const formatLabel = crudSetTransformFormatLabel(transform);
  const formatHint = crudSetTransformFormatHint(transform);
  const cardRoleColumns = columns ?? [column];

  return (
    <>
      <FormField
        label="Dataset field"
        hint="List-API field this column reads."
        required
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <DatasetFieldControl
          value={field}
          options={fieldOptions}
          ariaLabel={`Dataset field for ${crudSetColumnLabel(column)}`}
          onChange={(nextField) => {
            const nextLabel = column.label === crudSetHumanizeField(field)
              ? crudSetHumanizeField(nextField)
              : column.label;
            const nextMeta = resolveFieldMeta?.(nextField);
            onChange(crudSetCoerceColumnDisplay({
              ...column,
              field: nextField,
              label: nextLabel,
              secondaryField: column.secondaryField === nextField ? undefined : column.secondaryField,
            }, nextMeta));
          }}
        />
      </FormField>
      <FormField label="Label" required className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={column.label ?? crudSetColumnLabel(column)}
          onChange={(event) => patch({ label: event.target.value })}
          ariaLabel={`Label for ${field}`}
        />
      </FormField>
      <FormField
        label="Form placement"
        hint="Main body or the Edit / View side panel. Suggestion: checkboxes and lock status go in the side panel."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          value={crudSetColumnFormPlacement(column)}
          onChange={(event) => patch({
            formPlacement: isCrudSetFormPlacement(event.target.value) ? event.target.value : 'main',
          })}
          ariaLabel={`Form placement for ${field}`}
        >
          {CRUD_SET_FORM_PLACEMENTS.map((placement) => (
            <option key={placement} value={placement}>{CRUD_SET_FORM_PLACEMENT_LABELS[placement]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField
        label="Form control"
        hint="Auto infers from the cell kind and field name. Use password, color, image, HTML, or JSON when the field needs a specific control."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          value={column.formControl && isCrudSetFormControl(column.formControl) ? column.formControl : 'auto'}
          onChange={(event) => patch({
            formControl: isCrudSetFormControl(event.target.value) ? event.target.value : 'auto',
          })}
          ariaLabel={`Form control for ${field}`}
        >
          {CRUD_SET_FORM_CONTROLS.map((control) => (
            <option key={control} value={control}>{CRUD_SET_FORM_CONTROL_LABELS[control]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField
        label="Visible when field"
        hint="Empty always shows this field. Set a sibling field plus the equals value to hide it otherwise."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <DatasetFieldControl
          value={column.visibleWhen?.field ?? ''}
          options={fieldOptions}
          allowEmpty
          ariaLabel={`Visible-when field for ${field}`}
          onChange={(next) => patch({
            visibleWhen: next
              ? { field: next, equals: column.visibleWhen?.equals ?? '' }
              : undefined,
          })}
        />
      </FormField>
      {column.visibleWhen?.field ? (
        <FormField label="Visible when equals" className={fieldClassName} reserveHintSlot={false}>
          <UiInput
            size="sm"
            autoDir={false}
            value={column.visibleWhen.equals}
            onChange={(event) => patch({
              visibleWhen: { field: column.visibleWhen!.field, equals: event.target.value },
            })}
            ariaLabel={`Visible-when equals for ${field}`}
          />
        </FormField>
      ) : null}
      <FormField
        label="Secondary field"
        hint="Optional second dataset field in this same column."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <DatasetFieldControl
          value={secondaryField}
          options={secondaryOptions ?? fieldOptions}
          allowEmpty
          ariaLabel={`Secondary dataset field for ${field}`}
          onChange={(next) => patch({
            secondaryField: next || undefined,
            stack: next ? (column.stack === 'inline' ? 'inline' : 'stacked') : 'none',
          })}
        />
      </FormField>
      {secondaryField ? (
        <FormField label="Stack" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            value={crudSetColumnStack(column)}
            onChange={(event) => patch({
              stack: isCrudSetStackLayout(event.target.value) ? event.target.value : 'stacked',
            })}
            ariaLabel={`Stack layout for ${field}`}
          >
            {CRUD_SET_STACK_LAYOUTS.filter((layout) => layout !== 'none').map((layout) => (
              <option key={layout} value={layout}>{CRUD_SET_STACK_LAYOUT_LABELS[layout]}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      <FormField
        label="Display"
        hint="Cell chrome for this dataset field. Options depend on the field type."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          value={cellKind}
          onChange={(event) => onChange(crudSetColumnAfterCellKindChange(column, event.target.value, meta))}
          ariaLabel={`Display kind for ${field}`}
        >
          {displayKinds.map((kind) => (
            <option key={kind} value={kind}>{CRUD_SET_CELL_KIND_LABELS[kind]}</option>
          ))}
        </UiSelect>
      </FormField>
      {cellKind === 'image' ? (
        <FormField label="Image mask" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            value={crudSetColumnImageMask(column)}
            onChange={(event) => patch({
              imageMask: isCrudSetImageMask(event.target.value) ? event.target.value : 'none',
            })}
            ariaLabel={`Image mask for ${field}`}
          >
            {CRUD_SET_IMAGE_MASKS.map((mask) => (
              <option key={mask} value={mask}>{CRUD_SET_IMAGE_MASK_LABELS[mask]}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      <FormField
        label="Transform"
        hint="How the value is shown before chrome. Link columns keep the dataset value as the href."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          value={transform}
          onChange={(event) => onChange(crudSetColumnAfterTransformChange(column, event.target.value, meta))}
          ariaLabel={`Transform for ${field}`}
        >
          {transformOptions.map((item) => (
            <option key={item} value={item}>{CRUD_SET_COLUMN_TRANSFORM_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      {crudSetTransformUsesFormat(transform) ? (
        <FormField
          label={formatLabel ?? 'Format'}
          hint={formatHint ?? undefined}
          className={fieldClassName}
          reserveHintSlot={false}
        >
          <UiInput
            size="sm"
            autoDir={false}
            value={crudSetTransformFormatValue(column)}
            placeholder={crudSetTransformFormatPlaceholder(transform)}
            onChange={(event) => patch({ transformFormat: event.target.value })}
            ariaLabel={`${formatLabel ?? 'Format'} for ${field}`}
          />
        </FormField>
      ) : null}
      <CrudSetConfigCheckbox
        label="Sortable"
        checked={crudSetColumnSortable(column)}
        fieldClassName={fieldClassName}
        onChange={(checked) => patch({ sortable: checked })}
      />
      <CrudSetConfigCheckbox
        label="Filterable"
        checked={crudSetColumnFilterable(column)}
        fieldClassName={fieldClassName}
        onChange={(checked) => patch({ filterable: checked })}
      />
      <FormField
        label="Width"
        hint="Pixels. Empty uses the grid default."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiInput
          size="sm"
          autoDir={false}
          value={widthInputValue(column)}
          onChange={(event) => patch({ width: parseWidthInput(event.target.value) })}
          ariaLabel={`Width for ${field}`}
        />
      </FormField>
      <FormField label="Card role" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={crudSetColumnCardRole(column, cardRoleColumns, columnIndex)}
          onChange={(event) => {
            if (isCrudSetColumnCardRole(event.target.value)) {
              patch({ cardRole: event.target.value });
            }
          }}
          ariaLabel={`Card role for ${field}`}
        >
          {CRUD_SET_COLUMN_CARD_ROLES.map((role) => (
            <option key={role} value={role}>{CRUD_SET_COLUMN_CARD_ROLE_LABELS[role]}</option>
          ))}
        </UiSelect>
      </FormField>
      {cellKind !== 'image' ? (
        <FormField label="Card label" className={fieldClassName} reserveHintSlot={false}>
          <UiInput
            size="sm"
            autoDir={false}
            value={column.cardLabel ?? ''}
            onChange={(event) => patch({ cardLabel: event.target.value || undefined })}
            ariaLabel={`Card label for ${field}`}
          />
        </FormField>
      ) : null}
      <FormField label="Hide below" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={crudSetColumnHideBelow(column) ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            patch({ hideBelow: isCrudSetColumnHideBelow(next) ? next : undefined });
          }}
          ariaLabel={`Hide below for ${field}`}
        >
          <option value="">Always visible</option>
          {CRUD_SET_COLUMN_HIDE_BELOW.map((item) => (
            <option key={item} value={item}>{CRUD_SET_COLUMN_HIDE_BELOW_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Row header"
        checked={crudSetColumnIsRowHeader(column, columnIndex)}
        fieldClassName={fieldClassName}
        onChange={(checked) => patch({ isRowHeader: checked })}
      />
      <CrudSetConfigCheckbox
        label="Resizable"
        checked={column.resizable !== false}
        fieldClassName={fieldClassName}
        onChange={(checked) => patch({ resizable: checked })}
      />
      {enableColumnLayout ? (
        <>
          <CrudSetConfigCheckbox
            label="Hideable"
            checked={column.hideable !== false}
            fieldClassName={fieldClassName}
            onChange={(checked) => patch({ hideable: checked })}
          />
          <CrudSetConfigCheckbox
            label="Reorderable"
            checked={column.reorderable !== false}
            fieldClassName={fieldClassName}
            onChange={(checked) => patch({ reorderable: checked })}
          />
          <FormField label="Pin" className={fieldClassName} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              value={crudSetColumnPinned(column)}
              onChange={(event) => {
                if (isCrudSetColumnPin(event.target.value)) {
                  patch({ pinned: event.target.value });
                }
              }}
              ariaLabel={`Pin for ${field}`}
            >
              {CRUD_SET_COLUMN_PINS.map((item) => (
                <option key={item} value={item}>{CRUD_SET_COLUMN_PIN_LABELS[item]}</option>
              ))}
            </UiSelect>
          </FormField>
        </>
      ) : null}
      <FormField
        label="Conditional format"
        hint="First matching rule wins. Paints the cell background. Pick a pale fill."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <div className="flex flex-col gap-2">
          {rules.map((rule, index) => (
            <div key={`${rule.when}-${index}`} className="flex flex-col gap-1 rounded-md border border-slate-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Rule {index + 1}
                </span>
                <AppButton
                  type="button"
                  size="icon-sm"
                  className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
                  aria-label={`Remove conditional rule ${index + 1} for ${field}`}
                  onClick={() => patch({
                    conditionalFormat: rules.filter((_, ruleIndex) => ruleIndex !== index),
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              </div>
              <UiSelect
                size="sm"
                value={rule.when}
                onChange={(event) => {
                  const when = isCrudSetConditionalWhen(event.target.value)
                    ? event.target.value
                    : 'equals';
                  patch({
                    conditionalFormat: rules.map((item, ruleIndex) => (
                      ruleIndex === index ? { ...item, when } : item
                    )),
                  });
                }}
                ariaLabel={`Condition for ${field} rule ${index + 1}`}
              >
                {CRUD_SET_CONDITIONAL_WHENS.map((when) => (
                  <option key={when} value={when}>{CRUD_SET_CONDITIONAL_WHEN_LABELS[when]}</option>
                ))}
              </UiSelect>
              {fieldNeedsCompareValue(rule.when) ? (
                <UiInput
                  size="sm"
                  autoDir={false}
                  value={rule.value ?? ''}
                  onChange={(event) => patch({
                    conditionalFormat: rules.map((item, ruleIndex) => (
                      ruleIndex === index ? { ...item, value: event.target.value } : item
                    )),
                  })}
                  ariaLabel={`Compare value for ${field} rule ${index + 1}`}
                />
              ) : null}
              <FormField label="Background" className={fieldClassName} reserveHintSlot={false}>
                <UiColorPicker
                  size="sm"
                  variant="popover"
                  format="hex"
                  showPresets
                  presets={CRUD_SET_CONDITIONAL_BACKGROUND_PRESETS}
                  value={crudSetNormalizeConditionalBackground(rule.background)
                    ?? CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND}
                  onChange={(next) => {
                    const background = crudSetNormalizeConditionalBackground(next)
                      ?? CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND;
                    patch({
                      conditionalFormat: rules.map((item, ruleIndex) => (
                        ruleIndex === index ? { ...item, background } : item
                      )),
                    });
                  }}
                  ariaLabel={`Background for ${field} rule ${index + 1}`}
                />
              </FormField>
            </div>
          ))}
          <AppButton
            size="sm"
            intent="utility"
            aria-label={`Add conditional rule for ${field}`}
            onClick={() => patch({ conditionalFormat: [...rules, emptyRule()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </AppButton>
        </div>
      </FormField>
    </>
  );
};
