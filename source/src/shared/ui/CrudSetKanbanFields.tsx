import React from 'react';
import {
  CRUD_SET_KANBAN_COLUMN_LAYOUT_LABELS,
  CRUD_SET_KANBAN_COLUMN_LAYOUTS,
  CRUD_SET_KANBAN_COLUMN_WIDTH_LABELS,
  CRUD_SET_KANBAN_COLUMN_WIDTHS,
  CRUD_SET_KANBAN_DENSITIES,
  CRUD_SET_KANBAN_DENSITY_LABELS,
  CRUD_SET_KANBAN_HEIGHT_LABELS,
  CRUD_SET_KANBAN_HEIGHTS,
  CRUD_SET_KANBAN_TONE_LABELS,
  CRUD_SET_KANBAN_TONES,
  crudSetKanbanColoredColumns,
  crudSetKanbanColumnLayout,
  crudSetKanbanColumnWidth,
  crudSetKanbanDensity,
  crudSetKanbanDescriptionField,
  crudSetKanbanEnableKeyboardMove,
  crudSetKanbanHeight,
  crudSetKanbanHideEmptyColumns,
  crudSetKanbanInteractive,
  crudSetKanbanShowCardCount,
  crudSetKanbanShowDescriptions,
  crudSetKanbanStatusField,
  crudSetKanbanTitleField,
  crudSetKanbanTone,
  crudSetKanbanWipLimit,
  isCrudSetKanbanColumnLayout,
  isCrudSetKanbanColumnWidth,
  isCrudSetKanbanDensity,
  isCrudSetKanbanHeight,
  isCrudSetKanbanTone,
  type CrudSetKanbanConfig,
  type CrudSetKanbanStatusColumn,
  type CrudSetSpec,
} from '../../domain/component-designer/crudSetSpec';
import { FormField } from './FormSection';
import { AppButton } from './AppButton';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { UiSelect } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';

export type CrudSetKanbanFieldsProps = {
  kanban: CrudSetKanbanConfig;
  columns: CrudSetSpec['columns'];
  fieldOptions?: readonly string[];
  onChange: (next: CrudSetKanbanConfig) => void;
  fieldClassName?: string;
  selectClassName?: string;
};

/** UiKanbanBoard chrome for the CRUD Set wizard and living sample. */
export const CrudSetKanbanFields: React.FC<CrudSetKanbanFieldsProps> = ({
  kanban,
  columns,
  fieldOptions,
  onChange,
  fieldClassName,
  selectClassName,
}) => {
  const spec = { kanban, columns };
  const options = fieldOptions?.length
    ? [...fieldOptions]
    : columns.map((column) => column.field).filter(Boolean);
  const patch = (partial: Partial<CrudSetKanbanConfig>) => onChange({ ...kanban, ...partial });
  const coloredColumns = crudSetKanbanColoredColumns(spec);
  const interactive = crudSetKanbanInteractive(spec);

  return (
    <>
      <FormField label="Status field" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanStatusField(spec)}
          onChange={(event) => patch({ statusField: event.target.value })}
          ariaLabel="CRUD Set kanban status field"
        >
          {options.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField
        label="Status columns"
        hint="Board columns in left-to-right order. The status field is not shown as a toolbar filter in kanban."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <div className="flex flex-col gap-2">
          {(kanban.statusColumns ?? []).map((column, index) => (
            <div key={`${column.value}-${index}`} className="flex items-center gap-2">
              <UiInput
                size="sm"
                autoDir={false}
                className="min-w-0 flex-1"
                value={column.value}
                onChange={(event) => {
                  const next = [...(kanban.statusColumns ?? [])];
                  next[index] = { ...column, value: event.target.value };
                  patch({ statusColumns: next });
                }}
                ariaLabel={`Kanban status column ${index + 1} value`}
                placeholder="Value"
              />
              <UiInput
                size="sm"
                autoDir={false}
                className="min-w-0 flex-1"
                value={column.label ?? ''}
                onChange={(event) => {
                  const next = [...(kanban.statusColumns ?? [])];
                  next[index] = { ...column, label: event.target.value };
                  patch({ statusColumns: next });
                }}
                ariaLabel={`Kanban status column ${index + 1} label`}
                placeholder="Label"
              />
              <AppButton
                type="button"
                size="xs"
                intent="ghost"
                onClick={() => {
                  const next = (kanban.statusColumns ?? []).filter((_, itemIndex) => itemIndex !== index);
                  patch({ statusColumns: next });
                }}
              >
                Remove
              </AppButton>
            </div>
          ))}
          <AppButton
            type="button"
            size="xs"
            intent="secondary"
            onClick={() => {
              const next: CrudSetKanbanStatusColumn[] = [
                ...(kanban.statusColumns ?? []),
                { value: '', label: '' },
              ];
              patch({ statusColumns: next });
            }}
          >
            Add column
          </AppButton>
        </div>
      </FormField>
      <FormField label="Card title field" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanTitleField(spec)}
          onChange={(event) => patch({ titleField: event.target.value })}
          ariaLabel="CRUD Set kanban title field"
        >
          {options.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Card description field" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanDescriptionField(spec)}
          onChange={(event) => patch({ descriptionField: event.target.value })}
          ariaLabel="CRUD Set kanban description field"
        >
          {options.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Height" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanHeight(spec)}
          onChange={(event) => {
            if (isCrudSetKanbanHeight(event.target.value)) {
              patch({ height: event.target.value });
            }
          }}
          ariaLabel="CRUD Set kanban height"
        >
          {CRUD_SET_KANBAN_HEIGHTS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_KANBAN_HEIGHT_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Column width" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanColumnWidth(spec)}
          onChange={(event) => {
            if (isCrudSetKanbanColumnWidth(event.target.value)) {
              patch({ columnWidth: event.target.value });
            }
          }}
          ariaLabel="CRUD Set kanban column width"
        >
          {CRUD_SET_KANBAN_COLUMN_WIDTHS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_KANBAN_COLUMN_WIDTH_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Column layout" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanColumnLayout(spec)}
          onChange={(event) => {
            if (isCrudSetKanbanColumnLayout(event.target.value)) {
              patch({ columnLayout: event.target.value });
            }
          }}
          ariaLabel="CRUD Set kanban column layout"
        >
          {CRUD_SET_KANBAN_COLUMN_LAYOUTS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_KANBAN_COLUMN_LAYOUT_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Density" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetKanbanDensity(spec)}
          onChange={(event) => {
            if (isCrudSetKanbanDensity(event.target.value)) {
              patch({ density: event.target.value });
            }
          }}
          ariaLabel="CRUD Set kanban density"
        >
          {CRUD_SET_KANBAN_DENSITIES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_KANBAN_DENSITY_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Card count"
        checked={crudSetKanbanShowCardCount(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ showCardCount: checked })}
      />
      <CrudSetConfigCheckbox
        label="Descriptions"
        checked={crudSetKanbanShowDescriptions(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ showDescriptions: checked })}
      />
      <CrudSetConfigCheckbox
        label="Colored columns"
        checked={coloredColumns}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ coloredColumns: checked })}
      />
      {!coloredColumns ? (
        <FormField label="Column tone" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={selectClassName}
            value={crudSetKanbanTone(spec)}
            onChange={(event) => {
              if (isCrudSetKanbanTone(event.target.value)) {
                patch({ tone: event.target.value });
              }
            }}
            ariaLabel="CRUD Set kanban column tone"
          >
            {CRUD_SET_KANBAN_TONES.map((item) => (
              <option key={item} value={item}>{CRUD_SET_KANBAN_TONE_LABELS[item]}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      <CrudSetConfigCheckbox
        label="Hide empty"
        checked={crudSetKanbanHideEmptyColumns(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ hideEmptyColumns: checked })}
      />
      <CrudSetConfigCheckbox
        label="Drag cards"
        checked={interactive}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ interactive: checked })}
      />
      {interactive ? (
        <CrudSetConfigCheckbox
          label="Keyboard move"
          checked={crudSetKanbanEnableKeyboardMove(spec)}
          fieldClassName={fieldClassName}
          selectClassName={selectClassName}
          onChange={(checked) => patch({ enableKeyboardMove: checked })}
        />
      ) : null}
      <FormField label="WIP limit per column" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={String(crudSetKanbanWipLimit(spec))}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            patch({ wipLimit: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0 });
          }}
          ariaLabel="CRUD Set kanban WIP limit"
        />
      </FormField>
    </>
  );
};
