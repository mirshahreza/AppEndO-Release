import React from 'react';
import {
  CRUD_SET_SORT_DIRECTION_LABELS,
  CRUD_SET_SORT_DIRECTIONS,
  crudSetColumnLabel,
  crudSetColumnSortable,
  crudSetSortingDefaultDirection,
  crudSetSortingDefaultField,
  isCrudSetSortDirection,
  type CrudSetGridColumn,
  type CrudSetSortingConfig,
} from '../../domain/component-designer/crudSetSpec';
import { FormField } from './FormSection';
import { UiSelect } from './HeroFieldControls';

export type CrudSetSortingFieldsProps = {
  sorting: CrudSetSortingConfig;
  columns: readonly CrudSetGridColumn[];
  showFooter?: boolean;
  onChange: (next: CrudSetSortingConfig) => void;
  fieldClassName?: string;
  selectClassName?: string;
};

/** Sort defaults for the CRUD Set wizard and living sample. Footer sort toggle lives in paging fields. */
export const CrudSetSortingFields: React.FC<CrudSetSortingFieldsProps> = ({
  sorting,
  columns,
  showFooter = true,
  onChange,
  fieldClassName,
  selectClassName,
}) => {
  const spec = { columns: [...columns], sorting };
  const defaultField = crudSetSortingDefaultField(spec);
  const defaultDirection = crudSetSortingDefaultDirection(spec);
  const patch = (partial: Partial<CrudSetSortingConfig>) => onChange({ ...sorting, ...partial });
  const fieldOptions = columns.filter((column) => column.field.trim());

  return (
    <>
      {!showFooter ? (
        <p className="text-sm text-slate-500">
          Footer sort lives on the paging footer. Column-header sort still follows each column.
        </p>
      ) : null}
      <FormField label="Default sort field" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={defaultField}
          onChange={(event) => patch({ defaultField: event.target.value })}
          ariaLabel="CRUD Set default sort field"
        >
          {fieldOptions.map((column) => (
            <option key={column.field} value={column.field}>
              {crudSetColumnLabel(column)}
              {crudSetColumnSortable(column) ? '' : ' (header sort off)'}
            </option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Default direction" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={defaultDirection}
          onChange={(event) => {
            const next = event.target.value;
            if (isCrudSetSortDirection(next)) {
              patch({ defaultDirection: next });
            }
          }}
          ariaLabel="CRUD Set default sort direction"
        >
          {CRUD_SET_SORT_DIRECTIONS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_SORT_DIRECTION_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
    </>
  );
};
