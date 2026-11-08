import React, { useMemo, useState } from 'react';
import { Check, Save, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  CreateEditModalShell,
  CrudSetColumnList,
  CrudSetConfigCheckbox,
  FormField,
  FormSection,
  RecordForm,
  UiColorPicker,
  UiInput,
  UiSelect,
  RECORD_FORM_DOCKED_DIALOG_CHROME,
} from '../../../shared/ui';
import {
  CRUD_SET_DEFAULT_SIDE_PANEL_TITLE,
  CRUD_SET_FORM_DIALOG_SIZE_LABELS,
  CRUD_SET_FORM_DIALOG_SIZES,
  RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR,
  RECORD_FORM_DIALOG_SUB_FOOTER_COUNTS,
  RECORD_FORM_DIALOG_SUB_HEADER_COUNTS,
  RECORD_FORM_MODE_LABELS,
  RECORD_FORM_MODES,
  RECORD_FORM_SIDE_PANEL_BACKGROUND_LABELS,
  RECORD_FORM_SIDE_PANEL_BACKGROUNDS,
  RECORD_FORM_SIDE_PANEL_PLACEMENT_LABELS,
  RECORD_FORM_SIDE_PANEL_PLACEMENTS,
  crudSetDialogFormSizeForFieldCount,
  isCrudSetFormDialogSize,
  isRecordFormDialogSubFooterCount,
  isRecordFormDialogSubHeaderCount,
  isRecordFormMode,
  isRecordFormSidePanelBackground,
  isRecordFormSidePanelPlacement,
  recordFormFieldsIncludeSidePanel,
  type CrudSetFormDialogSize,
  type CrudSetGridColumn,
  type RecordFormDialogSubFooterCount,
  type RecordFormDialogSubHeaderCount,
  type RecordFormMode,
  type RecordFormSidePanelBackground,
  type RecordFormSidePanelPlacement,
} from '../../../domain/component-designer/crudSetSpec';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

const DEMO_COLUMNS: CrudSetGridColumn[] = [
  { field: 'code', label: 'Code', cellKind: 'text', formPlacement: 'main' },
  { field: 'title', label: 'Title', cellKind: 'text', formPlacement: 'main' },
  { field: 'status', label: 'Status', cellKind: 'badge', formPlacement: 'main' },
  { field: 'owner', label: 'Owner', cellKind: 'text', formPlacement: 'main' },
  { field: 'website', label: 'Website', cellKind: 'link', formPlacement: 'main' },
  { field: 'detailNote', label: 'Note', cellKind: 'text', formPlacement: 'main' },
  { field: 'active', label: 'Active', cellKind: 'boolean-icon', formPlacement: 'side' },
  { field: 'locked', label: 'Locked', cellKind: 'lock-status', formPlacement: 'side' },
];

const DEMO_VALUES: Record<string, unknown> = {
  code: 'REG-1',
  title: 'Northwind connector',
  status: 'Open',
  owner: 'Ada Lovelace',
  website: 'https://example.com',
  detailNote: 'Primary demo record.',
  active: true,
  locked: false,
};

const SUB_HEADER_BANDS = [
  'Record identity',
  'Status · Open',
  'Access follows the record policy.',
] as const;

export type EditViewBaseComponentsConfig = {
  mode: RecordFormMode;
  formSize: CrudSetFormDialogSize;
  showHeader: boolean;
  subHeaderCount: RecordFormDialogSubHeaderCount;
  showFooter: boolean;
  subFooterCount: RecordFormDialogSubFooterCount;
  sidePanelTitle: string;
  sidePanelPlacement: RecordFormSidePanelPlacement;
  sidePanelPinnable: boolean;
  sidePanelSplitter: boolean;
  sidePanelShowTitle: boolean;
  sidePanelTitleInHeader: boolean;
  sidePanelBackground: RecordFormSidePanelBackground;
  sidePanelBackgroundColor: string;
  columns: CrudSetGridColumn[];
};

export const DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG: EditViewBaseComponentsConfig = {
  mode: 'edit',
  formSize: 'lg',
  showHeader: true,
  subHeaderCount: 0,
  showFooter: true,
  subFooterCount: 0,
  sidePanelTitle: CRUD_SET_DEFAULT_SIDE_PANEL_TITLE,
  sidePanelPlacement: 'end',
  sidePanelPinnable: false,
  sidePanelSplitter: true,
  sidePanelShowTitle: true,
  sidePanelTitleInHeader: false,
  sidePanelBackground: 'theme',
  sidePanelBackgroundColor: RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR,
  columns: DEMO_COLUMNS,
};

export const resolveEditViewOptionLiveness = (config: EditViewBaseComponentsConfig) => ({
  component: 'RecordForm',
  mode: config.mode,
  formSize: crudSetDialogFormSizeForFieldCount({ dialogs: { formSize: config.formSize } }, config.columns.length),
  showHeader: config.showHeader,
  subHeaderCount: config.subHeaderCount,
  showFooter: config.showFooter,
  subFooterCount: config.subFooterCount,
  sidePanelTitle: config.sidePanelShowTitle
    ? (config.sidePanelTitle.trim() || CRUD_SET_DEFAULT_SIDE_PANEL_TITLE)
    : '',
  sidePanelPlacement: config.sidePanelPlacement,
  sidePanelPinnable: config.sidePanelPinnable,
  sidePanelSplitter: config.sidePanelSplitter,
  sidePanelShowTitle: config.sidePanelShowTitle,
  sidePanelTitleInHeader: config.sidePanelShowTitle && config.sidePanelTitleInHeader,
  sidePanelBackground: config.sidePanelBackground,
  sidePanelBackgroundColor: config.sidePanelBackground === 'custom'
    ? config.sidePanelBackgroundColor
    : '',
  sideFields: config.columns.filter((column) => column.formPlacement === 'side').map((column) => column.field),
});

export const EditViewBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState(DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG);
  const [values, setValues] = useState(DEMO_VALUES);
  const [open, setOpen] = useState(true);
  const liveness = resolveEditViewOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness, null, 2), [liveness]);
  const fields = config.columns.map((column) => column.field);
  const dialogSize = liveness.formSize;
  const readOnly = config.mode === 'view';
  const dockedSide = recordFormFieldsIncludeSidePanel(config.columns, fields);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="edit-view" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG);
            setValues(DEMO_VALUES);
          }}
          />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Form" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.mode}
                    onChange={(event) => {
                      if (isRecordFormMode(event.target.value)) {
                        setConfig((current) => ({ ...current, mode: event.target.value }));
                      }
                    }}
                    ariaLabel="Record form mode"
                  >
                    {RECORD_FORM_MODES.map((mode) => (
                      <option key={mode} value={mode}>{RECORD_FORM_MODE_LABELS[mode]}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField
                  label="Dialog size"
                  hint="More than four fields open at 4XL unless maximized or full."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  reserveHintSlot={false}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.formSize}
                    onChange={(event) => {
                      if (isCrudSetFormDialogSize(event.target.value)) {
                        setConfig((current) => ({ ...current, formSize: event.target.value }));
                      }
                    }}
                    ariaLabel="Record form dialog size"
                  >
                    {CRUD_SET_FORM_DIALOG_SIZES.map((size) => (
                      <option key={size} value={size}>{CRUD_SET_FORM_DIALOG_SIZE_LABELS[size]}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Dialog" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <CrudSetConfigCheckbox
                  label="Standard header"
                  checked={config.showHeader}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(showHeader) => setConfig((current) => ({ ...current, showHeader }))}
                />
                <FormField label="Sub-headers" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.subHeaderCount)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (isRecordFormDialogSubHeaderCount(next)) {
                        setConfig((current) => ({ ...current, subHeaderCount: next }));
                      }
                    }}
                    ariaLabel="Dialog sub-header count"
                  >
                    {RECORD_FORM_DIALOG_SUB_HEADER_COUNTS.map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <CrudSetConfigCheckbox
                  label="Standard footer"
                  checked={config.showFooter}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(showFooter) => setConfig((current) => ({ ...current, showFooter }))}
                />
                <FormField label="Sub-footers" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.subFooterCount)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (isRecordFormDialogSubFooterCount(next)) {
                        setConfig((current) => ({ ...current, subFooterCount: next }));
                      }
                    }}
                    ariaLabel="Dialog sub-footer count"
                  >
                    {RECORD_FORM_DIALOG_SUB_FOOTER_COUNTS.map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Side panel" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Placement" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.sidePanelPlacement}
                    onChange={(event) => {
                      if (isRecordFormSidePanelPlacement(event.target.value)) {
                        setConfig((current) => ({ ...current, sidePanelPlacement: event.target.value }));
                      }
                    }}
                    ariaLabel="Side panel placement"
                  >
                    {RECORD_FORM_SIDE_PANEL_PLACEMENTS.map((placement) => (
                      <option key={placement} value={placement}>
                        {RECORD_FORM_SIDE_PANEL_PLACEMENT_LABELS[placement]}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>
                <CrudSetConfigCheckbox
                  label="Pin button"
                  checked={config.sidePanelPinnable}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(sidePanelPinnable) => setConfig((current) => ({ ...current, sidePanelPinnable }))}
                />
                <CrudSetConfigCheckbox
                  label="Splitter"
                  checked={config.sidePanelSplitter}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(sidePanelSplitter) => setConfig((current) => ({ ...current, sidePanelSplitter }))}
                />
                <FormField
                  label="Background"
                  hint="Current theme uses the inspector wash."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  reserveHintSlot={false}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.sidePanelBackground}
                    onChange={(event) => {
                      if (isRecordFormSidePanelBackground(event.target.value)) {
                        setConfig((current) => ({ ...current, sidePanelBackground: event.target.value }));
                      }
                    }}
                    ariaLabel="Side panel background"
                  >
                    {RECORD_FORM_SIDE_PANEL_BACKGROUNDS.map((source) => (
                      <option key={source} value={source}>
                        {RECORD_FORM_SIDE_PANEL_BACKGROUND_LABELS[source]}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>
                {config.sidePanelBackground === 'custom' ? (
                  <FormField label="Color" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiColorPicker
                      size="sm"
                      variant="popover"
                      format="hex"
                      showPresets
                      value={config.sidePanelBackgroundColor}
                      onChange={(sidePanelBackgroundColor) => setConfig((current) => ({
                        ...current,
                        sidePanelBackgroundColor,
                      }))}
                      ariaLabel="Side panel background color"
                    />
                  </FormField>
                ) : null}
                <CrudSetConfigCheckbox
                  label="Title"
                  checked={config.sidePanelShowTitle}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(sidePanelShowTitle) => setConfig((current) => ({ ...current, sidePanelShowTitle }))}
                />
                {config.sidePanelShowTitle ? (
                  <>
                    <CrudSetConfigCheckbox
                      label="Title in header"
                      checked={config.sidePanelTitleInHeader}
                      fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                      selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      onChange={(sidePanelTitleInHeader) => setConfig((current) => ({
                        ...current,
                        sidePanelTitleInHeader,
                      }))}
                    />
                    <FormField label="Title text" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiInput
                        size="sm"
                        autoDir={false}
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.sidePanelTitle}
                        onChange={(event) => setConfig((current) => ({
                          ...current,
                          sidePanelTitle: event.target.value,
                        }))}
                        ariaLabel="Side panel title"
                      />
                    </FormField>
                  </>
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Columns" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <CrudSetColumnList
                  columns={config.columns}
                  fieldOptions={DEMO_COLUMNS.map((column) => column.field)}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  onChange={(columns) => setConfig((current) => ({ ...current, columns }))}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="edit-view" fill>
          {open ? (
            <CreateEditModalShell
              title={RECORD_FORM_MODE_LABELS[config.mode]}
              size={dialogSize}
              contained
              showHeader={config.showHeader}
              onClose={() => setOpen(false)}
              {...(dockedSide ? RECORD_FORM_DOCKED_DIALOG_CHROME : {})}
              subtitle={config.subHeaderCount >= 1 ? SUB_HEADER_BANDS[0] : undefined}
              metaBand={config.subHeaderCount >= 2 ? SUB_HEADER_BANDS[1] : undefined}
              secondaryMetaBand={config.subHeaderCount >= 3 ? SUB_HEADER_BANDS[2] : undefined}
              auxiliaryFooter={config.subFooterCount >= 1 ? (
                <p className="text-xs text-slate-600">Review flags before save.</p>
              ) : undefined}
              intermediateFooter={config.subFooterCount >= 2 ? (
                <p className="text-xs font-medium text-amber-800">Locked records stay read-only.</p>
              ) : undefined}
              footer={config.showFooter ? (
                readOnly ? (
                  <AppButton intent="cancel" size="sm" onClick={() => setOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                    Close
                  </AppButton>
                ) : (
                  <>
                    <AppButton intent="cancel" size="sm" onClick={() => setOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </AppButton>
                    <AppButton intent="primary" size="sm">
                      {config.mode === 'create' ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                      {config.mode === 'create' ? 'Create' : 'Save'}
                    </AppButton>
                  </>
                )
              ) : undefined}
            >
              <RecordForm
                mode={config.mode}
                columns={config.columns}
                fields={fields}
                values={values}
                onChange={setValues}
                sidePanelTitle={liveness.sidePanelTitle || CRUD_SET_DEFAULT_SIDE_PANEL_TITLE}
                sidePanelPlacement={config.sidePanelPlacement}
                sidePanelPinnable={config.sidePanelPinnable}
                sidePanelSplitter={config.sidePanelSplitter}
                sidePanelShowTitle={config.sidePanelShowTitle}
                sidePanelTitleInHeader={config.sidePanelTitleInHeader}
                sidePanelBackground={config.sidePanelBackground}
                sidePanelBackgroundColor={config.sidePanelBackgroundColor}
                selectOptions={(field) => (field === 'status' ? ['Open', 'Approved', 'Shipped'] : [])}
              />
            </CreateEditModalShell>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <AppButton intent="primary" size="sm" onClick={() => setOpen(true)}>
                Open {RECORD_FORM_MODE_LABELS[config.mode].toLowerCase()}
              </AppButton>
            </div>
          )}
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
