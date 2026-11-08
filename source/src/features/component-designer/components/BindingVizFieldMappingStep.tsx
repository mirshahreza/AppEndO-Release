import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  DesignerVizFieldMapping,
  DesignerVizSheetFieldMapping,
  VizWidgetKind,
} from '../../../domain/component-designer/visualizationDataTransform';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { BindingDataFlowHint } from './BindingDataFlowHint';
import { InspectorDynamicActionsField } from './InspectorDynamicActionsField';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export type BindingVizFieldMappingStepProps = {
  widgetKind: VizWidgetKind;
  availableFields: string[];
  mapping: DesignerVizFieldMapping;
  onChange: (mapping: DesignerVizFieldMapping) => void;
  document?: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions;
};

const FieldSelect: React.FC<{
  label: string;
  hint?: string;
  value: string;
  fields: string[];
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}> = ({ label, hint, value, fields, allowEmpty, onChange }) => (
  <div>
    <DesignerFieldRow label={label}>
      <UiSelect size="sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {(allowEmpty ? ['', ...fields] : (fields.length > 0 ? fields : [value])).map((field) => (
          <option key={field || '__empty__'} value={field}>{field || '— none —'}</option>
        ))}
      </UiSelect>
    </DesignerFieldRow>
    {hint ? <p className="mt-[2px] ps-[4px] text-[10px] text-slate-500">{hint}</p> : null}
  </div>
);

const humanizeField = (field: string): string =>
  field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const BindingVizFieldMappingStep: React.FC<BindingVizFieldMappingStepProps> = ({
  availableFields,
  mapping,
  onChange,
  document,
  bindingDefinitions,
}) => {
  if (mapping.kind === 'tree') {
    return (
      <div className="space-y-3">
        <BindingDataFlowHint
          sourceLabel="List API"
          targetLabel="Tree"
          description="Pick which API fields become node ID, visible label, and optional parent link. Flat lists work without a parent field; nested trees need parent ID."
        />
        <FieldSelect label="ID field" hint="Unique identifier for each node." value={mapping.idField} fields={availableFields} onChange={(idField) => onChange({ ...mapping, idField })} />
        <FieldSelect label="Label field" hint="Text shown next to each node." value={mapping.labelField} fields={availableFields} onChange={(labelField) => onChange({ ...mapping, labelField })} />
        <FieldSelect
          label="Parent ID field"
          hint="Optional — links child nodes to their parent for hierarchy."
          value={mapping.parentIdField ?? ''}
          fields={availableFields}
          allowEmpty
          onChange={(parentIdField) => onChange({
            ...mapping,
            ...(parentIdField ? { parentIdField } : { parentIdField: undefined }),
          })}
        />
      </div>
    );
  }

  if (mapping.kind === 'timeline' || mapping.kind === 'gantt') {
    return (
      <div className="space-y-3">
        <BindingDataFlowHint
          sourceLabel="List API"
          targetLabel={mapping.kind === 'gantt' ? 'Gantt' : 'Timeline'}
          description="Each API row becomes one event on the timeline. Map title and start date; end date is optional for open-ended events."
        />
        <FieldSelect label="Title field" value={mapping.titleField} fields={availableFields} onChange={(titleField) => onChange({ ...mapping, titleField })} />
        <FieldSelect label="Start date field" value={mapping.startField} fields={availableFields} onChange={(startField) => onChange({ ...mapping, startField })} />
        <FieldSelect label="End date field" hint="Optional — leave empty for point-in-time events." value={mapping.endField ?? ''} fields={availableFields} allowEmpty onChange={(endField) => onChange({ ...mapping, ...(endField ? { endField } : { endField: undefined }) })} />
        <FieldSelect label="Description field" hint="Optional extra text." value={mapping.descriptionField ?? ''} fields={availableFields} allowEmpty onChange={(descriptionField) => onChange({ ...mapping, ...(descriptionField ? { descriptionField } : { descriptionField: undefined }) })} />
        {mapping.kind === 'gantt' ? (
          <FieldSelect
            label="Progress field"
            hint="Optional — a 0-100 percent-complete column, shown as a filled portion of each bar."
            value={mapping.progressField ?? ''}
            fields={availableFields}
            allowEmpty
            onChange={(progressField) => onChange({ ...mapping, ...(progressField ? { progressField } : { progressField: undefined }) })}
          />
        ) : null}
      </div>
    );
  }

  if (mapping.kind === 'kanban') {
    return (
      <div className="space-y-3">
        <BindingDataFlowHint
          sourceLabel="List API"
          targetLabel="Kanban"
          description="Flat card rows are grouped by the column/status field into swimlanes. Define column order below so columns appear in the right sequence."
        />
        <FieldSelect label="Card ID field" value={mapping.cardIdField} fields={availableFields} onChange={(cardIdField) => onChange({ ...mapping, cardIdField })} />
        <FieldSelect label="Card title field" value={mapping.cardTitleField} fields={availableFields} onChange={(cardTitleField) => onChange({ ...mapping, cardTitleField })} />
        <FieldSelect label="Column / status field" hint="API field whose value determines which column a card belongs to." value={mapping.cardColumnField} fields={availableFields} onChange={(cardColumnField) => onChange({ ...mapping, cardColumnField })} />
        <FieldSelect label="Description field" hint="Optional." value={mapping.cardDescriptionField ?? ''} fields={availableFields} allowEmpty onChange={(cardDescriptionField) => onChange({ ...mapping, ...(cardDescriptionField ? { cardDescriptionField } : { cardDescriptionField: undefined }) })} />

        <div className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Column order</p>
              <p className="ps-[4px] text-[10px] text-slate-500">Match the status values your API returns (e.g. todo, doing, done).</p>
            </div>
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => onChange({
                ...mapping,
                columnOrder: [...(mapping.columnOrder ?? []), { id: `col${(mapping.columnOrder ?? []).length + 1}`, title: 'New column' }],
              })}
            >
              <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
              Add column
            </AppButton>
          </div>
          {(mapping.columnOrder ?? []).map((column, index) => (
            <div key={`kanban-col-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <DesignerFieldRow label="Status value (API)">
                <UiInput
                  size="sm"
                  nested
                  value={column.id}
                  onChange={(event) => {
                    const next = [...(mapping.columnOrder ?? [])];
                    next[index] = { ...column, id: event.target.value };
                    onChange({ ...mapping, columnOrder: next });
                  }}
                  placeholder="todo"
                />
              </DesignerFieldRow>
              <DesignerFieldRow label="Column title">
                <UiInput
                  size="sm"
                  nested
                  value={column.title}
                  onChange={(event) => {
                    const next = [...(mapping.columnOrder ?? [])];
                    next[index] = { ...column, title: event.target.value };
                    onChange({ ...mapping, columnOrder: next });
                  }}
                  placeholder="To Do"
                />
              </DesignerFieldRow>
              <AppButton
                type="button"
                intent="destructive"
                size="sm"
                className="mb-[1px] h-8 w-8 px-0"
                onClick={() => onChange({
                  ...mapping,
                  columnOrder: (mapping.columnOrder ?? []).filter((_, i) => i !== index),
                })}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </AppButton>
            </div>
          ))}
          {(mapping.columnOrder ?? []).length === 0 ? (
            <p className="ps-[4px] text-[10px] text-slate-500">Optional — without column order, columns appear in the order values are first seen in data.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const sheetMapping = mapping as DesignerVizSheetFieldMapping;
  return (
    <div className="space-y-3">
      <BindingDataFlowHint
        sourceLabel="List API"
        targetLabel="Sheet"
        description="Each API row becomes one spreadsheet row. Pick API fields for columns; header text is what users see in the sheet header."
      />
      <div className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Columns</p>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              const nextField = availableFields.find((field) => !sheetMapping.columns.some((column) => column.field === field)) ?? 'value';
              onChange({
                ...sheetMapping,
                columns: [...sheetMapping.columns, { header: humanizeField(nextField), field: nextField, type: 'text' }],
              });
            }}
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Add column
          </AppButton>
        </div>
        {sheetMapping.columns.map((column, index) => (
          <div key={`sheet-col-${index}`} className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 p-2`}>
            <div className="grid grid-cols-[1fr_1fr_160px_auto] items-end gap-2">
              <DesignerFieldRow label="Header (shown to user)">
                <UiInput size="sm" nested value={column.header} onChange={(event) => {
                  const next = [...sheetMapping.columns];
                  next[index] = { ...column, header: event.target.value };
                  onChange({ ...sheetMapping, columns: next });
                }} />
              </DesignerFieldRow>
              <DesignerFieldRow label="API field">
                <UiSelect size="sm" nested value={column.field} onChange={(event) => {
                  const field = event.target.value;
                  const next = [...sheetMapping.columns];
                  next[index] = {
                    ...column,
                    field,
                    header: column.header === humanizeField(column.field) || column.header === column.field
                      ? humanizeField(field)
                      : column.header,
                  };
                  onChange({ ...sheetMapping, columns: next });
                }}>
                  {(availableFields.length > 0 ? availableFields : [column.field]).map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
              <DesignerFieldRow label="Column type">
                <UiSelect size="sm" nested value={column.type ?? 'text'} onChange={(event) => {
                  const type = event.target.value as 'text' | 'number' | 'select' | 'formula';
                  const next = [...sheetMapping.columns];
                  next[index] = {
                    ...column,
                    type,
                    ...(type === 'formula' ? {} : { formula: undefined }),
                    ...(type === 'select' ? {} : { options: undefined }),
                  };
                  onChange({ ...sheetMapping, columns: next });
                }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                  <option value="formula">Formula</option>
                </UiSelect>
              </DesignerFieldRow>
              <AppButton
                type="button"
                intent="destructive"
                size="sm"
                className="mb-[1px] h-8 w-8 px-0"
                disabled={sheetMapping.columns.length <= 1}
                onClick={() => onChange({ ...sheetMapping, columns: sheetMapping.columns.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </AppButton>
            </div>
            {column.type === 'formula' ? (
              <DesignerFieldRow label="Formula">
                <UiInput
                  size="sm"
                  nested
                  autoDir={false}
                  placeholder="= qty * price"
                  value={column.formula ?? ''}
                  onChange={(event) => {
                    const next = [...sheetMapping.columns];
                    next[index] = { ...column, formula: event.target.value };
                    onChange({ ...sheetMapping, columns: next });
                  }}
                />
              </DesignerFieldRow>
            ) : null}
            {column.type === 'select' ? (
              <DesignerFieldRow label="Select options">
                <UiInput
                  size="sm"
                  nested
                  placeholder="todo, doing, done"
                  value={(column.options ?? []).join(', ')}
                  onChange={(event) => {
                    const next = [...sheetMapping.columns];
                    next[index] = {
                      ...column,
                      options: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean),
                    };
                    onChange({ ...sheetMapping, columns: next });
                  }}
                />
              </DesignerFieldRow>
            ) : null}
            {document && bindingDefinitions ? (
              <InspectorDynamicActionsField
                document={document}
                bindingDefinitions={bindingDefinitions}
                trueActions={column.onCellChangeAction ?? []}
                onChange={(nextActions) => {
                  const next = [...sheetMapping.columns];
                  next[index] = {
                    ...column,
                    onCellChangeAction: nextActions,
                  };
                  onChange({ ...sheetMapping, columns: next });
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
