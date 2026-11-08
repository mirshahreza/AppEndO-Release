import React from 'react';
import type { BaseInfoEditForm } from '../api/contracts/base-info/editForm';
import {
  RECORD_FORM_SIDE_PANEL_WIDTH_PX,
  resolveRecordFormSidePanelBackgroundColor,
  type CrudSetGridColumn,
} from '../../domain/component-designer/crudSetSpec';

const BASE_INFO_SIDE_PANEL_TITLE = 'Status & display';
import { UiColorField } from '../../components/ui/UiColorField';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { FormField, FormSection } from './FormSection';
import { UiTextarea } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { RECORD_FORM_DOCKED_MAIN_CLASS } from './RecordForm';
import { DesignerCodeEditorField } from './DesignerFormFields';
import { INSPECTOR_RAIL_TITLE_CLASS } from './surfaceClasses';

const UI_HTML_EDITOR_HEIGHT_PX = 320;

export type BaseInfoFormFieldsProps = {
  form: BaseInfoEditForm;
  onFormChange: (updater: (previous: BaseInfoEditForm) => BaseInfoEditForm) => void;
  isCreateMode: boolean;
  parentDisplayValue: string;
  titleFieldError?: string | null;
};

const NOTE_TEXTAREA_ROWS = 2;

/** Column metadata for designer hidden fields and CRUD bridges — not the render tree. */
export const BASE_INFO_RECORD_FORM_COLUMNS: CrudSetGridColumn[] = [
  { field: 'isActive', label: 'Active', cellKind: 'boolean-icon', formPlacement: 'side' },
  { field: 'parentDisplay', label: 'Parent', formPlacement: 'side' },
  { field: 'childDigits', label: 'Child Digits', formPlacement: 'main' },
  { field: 'title', label: 'Title (canonical)', formPlacement: 'main' },
  { field: 'note', label: 'Note (canonical)', formPlacement: 'main', formControl: 'textarea' },
  { field: 'viewOrder', label: 'View Order', formPlacement: 'side' },
  { field: 'value', label: 'Value', formPlacement: 'side' },
  { field: 'metadata', label: 'Metadata', formPlacement: 'main', formControl: 'textarea' },
  { field: 'uiColor', label: 'UI Color', formPlacement: 'side', formControl: 'color' },
  { field: 'uiHtml', label: 'UI Html', formPlacement: 'main', formControl: 'html' },
];

const patchForm = (
  onFormChange: BaseInfoFormFieldsProps['onFormChange'],
  updater: (previous: BaseInfoEditForm) => BaseInfoEditForm,
) => {
  onFormChange(updater);
};

export const BaseInfoFormFields: React.FC<BaseInfoFormFieldsProps> = ({
  form,
  onFormChange,
  isCreateMode,
  parentDisplayValue,
  titleFieldError,
}) => {
  const setScalar = (key: keyof BaseInfoEditForm, value: string) => {
    patchForm(onFormChange, (previous) => ({ ...previous, [key]: value }));
  };

  const sideFill = resolveRecordFormSidePanelBackgroundColor('theme');

  const titleField = (
    <FormField
      label="Title (canonical)"
      required
      invalid={Boolean(titleFieldError)}
      error={titleFieldError ?? undefined}
    >
      <UiInput
        size="sm"
        value={form.title}
        ariaLabel="Title (canonical)"
        onChange={(event) => setScalar('title', event.target.value)}
      />
    </FormField>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden"
      data-testid="record-form"
      data-docked="true"
    >
      <div className={RECORD_FORM_DOCKED_MAIN_CLASS} data-testid="record-form-main">
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-3">
            {isCreateMode ? (
              <FormField label="Child digits">
                <UiInput
                  size="sm"
                  autoDir={false}
                  value={form.childDigits}
                  ariaLabel="Child digits"
                  onChange={(event) => setScalar('childDigits', event.target.value)}
                />
              </FormField>
            ) : null}
            {titleField}
            <FormField label="Note (canonical)">
              <UiTextarea
                value={form.note}
                ariaLabel="Note (canonical)"
                rows={NOTE_TEXTAREA_ROWS}
                onChange={(event) => setScalar('note', event.target.value)}
              />
            </FormField>
          </div>

          <FormSection
            title="Presentation"
            ink="contrast"
            divided
            hint="Optional JSON metadata and HTML used on catalog cards and rich cells."
          >
            <FormField label="Metadata">
              <UiTextarea
                value={form.metadata}
                ariaLabel="Metadata"
                rows={NOTE_TEXTAREA_ROWS}
                autoDir={false}
                className="font-mono"
                onChange={(event) => setScalar('metadata', event.target.value)}
              />
            </FormField>
            <FormField label="UI Html">
              <DesignerCodeEditorField
                language="html"
                value={form.uiHtml}
                onChange={(html) => setScalar('uiHtml', html)}
                editorHeight={UI_HTML_EDITOR_HEIGHT_PX}
                lineNumbers
                wordWrap
                minimap={false}
                aiAssist={false}
                ariaLabel="UI Html"
                placeholder='<i data-lucide="User"></i>'
                className="min-w-0"
              />
            </FormField>
          </FormSection>
        </div>
      </div>

      <aside
        className="flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden border-s border-[color:var(--app-inspector-rail-border)]"
        style={{ width: RECORD_FORM_SIDE_PANEL_WIDTH_PX, backgroundColor: sideFill }}
        data-testid="record-form-side"
        data-placement="end"
        data-docked="true"
      >
        <div className="flex h-9 shrink-0 items-center border-b border-slate-200 px-3">
          <h3 className={INSPECTOR_RAIL_TITLE_CLASS}>{BASE_INFO_SIDE_PANEL_TITLE}</h3>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <FormField label="Parent">
            <p className="text-sm text-slate-700">{parentDisplayValue}</p>
          </FormField>
          <CrudSetConfigCheckbox
            label="Active"
            checked={form.isActive}
            control="checkbox"
            onChange={(next) => patchForm(onFormChange, (previous) => ({ ...previous, isActive: next }))}
          />
          <FormField label="View order">
            <UiInput
              size="sm"
              autoDir={false}
              value={form.viewOrder}
              ariaLabel="View order"
              onChange={(event) => setScalar('viewOrder', event.target.value)}
            />
          </FormField>
          <FormField label="Value">
            <UiInput
              size="sm"
              autoDir={false}
              value={form.value}
              ariaLabel="Value"
              onChange={(event) => setScalar('value', event.target.value)}
            />
          </FormField>
          <FormField label="UI color">
            <UiColorField
              value={form.uiColor}
              ariaLabel="UI color"
              clearable
              onChange={(next) => setScalar('uiColor', next)}
            />
          </FormField>
        </div>
      </aside>
    </div>
  );
};
