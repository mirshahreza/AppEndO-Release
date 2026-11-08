import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  CRUD_SET_SUGGESTED_COLUMN_FIELDS,
  crudSetColumnFromField,
  crudSetColumnId,
  crudSetColumnLabel,
  crudSetHumanizeField,
  type CrudSetGridColumn,
} from '../../domain/component-designer/crudSetSpec';
import type { CrudSetFieldMeta } from '../../domain/component-designer/crudSetColumnDisplayPolicy';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import { AppSurfaceBox } from './AppSurfaceBox';
import { CreateEditModalShell } from './CreateEditModalShell';
import { CrudSetColumnPropertyFields } from './CrudSetColumnFields';
import { FORM_SECTION_BODY_STACK_CLASS, FormFieldLayoutProvider } from './FormSection';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_EDIT_CLASS,
} from './surfaceClasses';

export type CrudSetColumnListProps = {
  columns: CrudSetGridColumn[];
  onChange: (next: CrudSetGridColumn[]) => void;
  fieldOptions?: readonly string[];
  /** Unused suggested dataset fields shown as add chips. Default: living-sample list. */
  suggestedFields?: readonly string[];
  resolveFieldMeta?: (fieldName: string) => CrudSetFieldMeta | undefined;
  fieldClassName?: string;
  enableColumnLayout?: boolean;
};

const moveItem = <T,>(items: readonly T[], index: number, delta: -1 | 1): T[] => {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
};

/** Compact column name rows; details open in CreateEditModalShell. */
export const CrudSetColumnList: React.FC<CrudSetColumnListProps> = ({
  columns,
  onChange,
  fieldOptions,
  suggestedFields = CRUD_SET_SUGGESTED_COLUMN_FIELDS,
  resolveFieldMeta,
  fieldClassName,
  enableColumnLayout = false,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (editingIndex != null && editingIndex >= columns.length) {
      setEditingIndex(null);
    }
  }, [columns.length, editingIndex]);

  const editing = editingIndex != null ? columns[editingIndex] : undefined;
  const closeEditor = () => setEditingIndex(null);
  const usedFields = new Set(columns.map((column) => column.field));
  const availableSuggestions = suggestedFields.filter((field) => !usedFields.has(field));
  const resolvedFieldOptions = [...new Set([
    ...(fieldOptions ?? []),
    ...suggestedFields,
    ...columns.map((column) => column.field),
  ])].filter(Boolean);

  const addColumn = (field: string) => {
    onChange([...columns, crudSetColumnFromField(field, columns)]);
  };

  const moveColumn = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= columns.length) {
      return;
    }
    onChange(moveItem(columns, index, delta));
    if (editingIndex === index) {
      setEditingIndex(nextIndex);
    } else if (editingIndex === nextIndex) {
      setEditingIndex(index);
    }
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, itemIndex) => itemIndex !== index));
    if (editingIndex == null) {
      return;
    }
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1">
      {columns.map((column, index) => {
        const label = crudSetColumnLabel(column);
        return (
          <AppSurfaceBox
            key={`${crudSetColumnId(column)}-${index}`}
            layout="strip"
            className="flex min-h-7 items-center gap-1.5 px-2 py-1"
          >
            <AppButton
              type="button"
              size="icon-sm"
              className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_EDIT_CLASS, 'shrink-0')}
              aria-label={`Edit ${label}`}
              onClick={() => setEditingIndex(index)}
            >
              <Pencil className="h-3 w-3" />
            </AppButton>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{label}</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <AppButton
                type="button"
                size="icon-sm"
                className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_CANCEL_CLASS)}
                aria-label={`Move column ${index + 1} up`}
                disabled={index === 0}
                onClick={() => moveColumn(index, -1)}
              >
                <ChevronUp className="h-3 w-3" />
              </AppButton>
              <AppButton
                type="button"
                size="icon-sm"
                className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_CANCEL_CLASS)}
                aria-label={`Move column ${index + 1} down`}
                disabled={index === columns.length - 1}
                onClick={() => moveColumn(index, 1)}
              >
                <ChevronDown className="h-3 w-3" />
              </AppButton>
              <AppButton
                type="button"
                size="icon-sm"
                className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
                aria-label={`Remove column ${label}`}
                onClick={() => removeColumn(index)}
              >
                <Trash2 className="h-3 w-3" />
              </AppButton>
            </div>
          </AppSurfaceBox>
        );
      })}
      </div>
      {availableSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {availableSuggestions.map((field) => (
            <AppButton
              key={field}
              size="sm"
              intent="utility"
              aria-label={`Add column ${field}`}
              onClick={() => addColumn(field)}
            >
              <Plus className="h-3.5 w-3.5" />
              {crudSetHumanizeField(field)}
            </AppButton>
          ))}
        </div>
      ) : null}
      <AppButton
        size="sm"
        intent="utility"
        aria-label="Add column"
        onClick={() => addColumn(`column${columns.length + 1}`)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add column
      </AppButton>
      {editing && editingIndex != null ? (
        <CreateEditModalShell
          title={`Edit ${crudSetColumnLabel(editing)}`}
          onClose={closeEditor}
          onBackdropClick={closeEditor}
          size="xl"
          footer={(
            <AppButton intent="primary" size="sm" onClick={closeEditor}>
              <Check className="h-3.5 w-3.5" />
              Done
            </AppButton>
          )}
        >
          <FormFieldLayoutProvider layout="side">
            <div className={FORM_SECTION_BODY_STACK_CLASS}>
              <CrudSetColumnPropertyFields
                column={editing}
                columns={columns}
                columnIndex={editingIndex}
                enableColumnLayout={enableColumnLayout}
                fieldOptions={resolvedFieldOptions.length > 0 ? resolvedFieldOptions : fieldOptions}
                resolveFieldMeta={resolveFieldMeta}
                fieldClassName={fieldClassName}
                onChange={(next) => {
                  onChange(columns.map((item, itemIndex) => (
                    itemIndex === editingIndex ? next : item
                  )));
                }}
              />
            </div>
          </FormFieldLayoutProvider>
        </CreateEditModalShell>
      ) : null}
    </>
  );
};
