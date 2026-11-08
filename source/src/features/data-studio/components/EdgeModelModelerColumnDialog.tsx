import React, { useEffect, useState } from 'react';
import { Columns3, ImageIcon, KeyRound, RotateCcw, Save, X } from 'lucide-react';
import { useOptionalCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import type {
  ColumnFormWidget,
  ColumnFormWidgetProps,
  ColumnFilterRole,
  ColumnSearchRole,
  EdgeModelColumn,
  EdgeModelDefinition,
  EdgeModelStudioColumnMeta,
  RelationFormWidget,
} from '../../../shared/api/contracts/data-api';
import {
  COLUMN_FORM_WIDGET_AUTO_SELECT_VALUE,
  COLUMN_FORM_WIDGET_OPTIONS,
  COLUMN_FILTER_ROLE_OPTIONS,
  COLUMN_SEARCH_ROLE_OPTIONS,
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
  applyColumnFormWidgetPropDefaults,
  createEmptyColumnFormWidgetProps,
  relationFormWidgetOptionsForKind,
  resolveBelongsToFormWidget,
} from '../../../shared/api/contracts/data-api';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import {
  AppButton,
  FloatingPanelShell,
  FormField,
  FormSection,
  UiCheckbox,
  UiInput,
  UiSelect,
  UiTextarea,
} from '../../../shared/ui';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import {
  normalizeRelationAttachedFields,
  validateRelationAttachedFields,
  type RelationAttachedField,
} from '../lib/belongsToAttachedFields';
import {
  formatColumnDisplayNameFormula,
  isColumnDisplayNameFormula,
  normalizeColumnDisplayLabelForStorage,
  resolveColumnDisplayName,
} from '../lib/resolveColumnDisplayName';
import {
  MODELER_FLOATING_PANEL_HEADER_BAND_CLASS,
  MODELER_FLOATING_PANEL_HEADER_CLASS,
  MODELER_FLOATING_PANEL_TITLE_CLASS,
  MODELER_PANEL_BORDER_COLUMN_CLASS,
} from '../lib/modelerChipStyles';
import { ColumnFormWidgetPropsFields } from './ColumnFormWidgetPropsFields';
import { EdgeModelBelongsToAttachedFieldsEditor } from './EdgeModelBelongsToAttachedFieldsEditor';
import {
  ColumnHistoryFields,
  type ColumnHistoryForm,
} from './EdgeModelHistoryFields';

const PANEL_BOUNDS = {
  minWidth: 720,
  maxWidth: 1280,
  minHeight: 640,
  maximizeInset: 24,
};

export type EdgeModelModelerColumnStudioForm = {
  displayLabel: string;
  icon: string;
  /** Scalar column widget (non-FK). Empty means Auto (by type). */
  formWidget: ColumnFormWidget | '';
  formWidgetProps: ColumnFormWidgetProps;
  /**
   * Belongs-to FK picker widget (stored on associationMeta).
   * Empty is normalized to Select when the column has a relation.
   */
  relationFormWidget: RelationFormWidget | '';
  /** Required in generated forms. Forced true when the column is not nullable. */
  required: boolean;
  searchRole: ColumnSearchRole;
  filterRole: ColumnFilterRole;
  developerNotes: string;
  interfaceNotes: string;
  /** Belongs-to attached target fields (only when this column is an FK). */
  attachedFields: RelationAttachedField[];
  cubeMeasureEnabled: boolean;
  cubeAggregation: NonNullable<EdgeModelStudioColumnMeta['cubeMeasure']>['aggregation'];
  cubeAdditivity: NonNullable<EdgeModelStudioColumnMeta['cubeMeasure']>['additivity'];
  cubeSemiAdditiveOver: string;
  history: ColumnHistoryForm;
};

export type EdgeModelModelerColumnBelongsToAttach = {
  foreignKey: string;
  associationAs: string;
  targetModel: Pick<EdgeModelDefinition, 'objectName' | 'labels' | 'columns' | 'primaryKey'>;
};

export type EdgeModelModelerColumnDialogProps = {
  open: boolean;
  column: EdgeModelColumn | null;
  initialValues: EdgeModelModelerColumnStudioForm;
  belongsToAttach?: EdgeModelModelerColumnBelongsToAttach | null;
  lifecycleField?: string | null;
  onSave: (values: EdgeModelModelerColumnStudioForm) => void;
  onClose: () => void;
};

const SUMMARY_VALUE_TONE_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'border-slate-200 bg-slate-50/80 text-slate-800',
  violet: 'border-violet-200 bg-violet-50/70 text-violet-900',
  cyan: 'border-cyan-200 bg-cyan-50/70 text-cyan-900',
  indigo: 'border-indigo-200 bg-indigo-50/70 text-indigo-900',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
  rose: 'border-rose-200 bg-rose-50/70 text-rose-900',
};

const SUMMARY_LABEL_TONE_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-slate-500',
  violet: 'text-violet-600',
  cyan: 'text-cyan-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

type SummaryRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  /** Small-area accent for the value chip — meaning-matched, not decorative. */
  tone?: AppSurfaceBoxTone;
};

const SummaryRow: React.FC<SummaryRowProps> = ({
  label,
  value,
  mono = false,
  tone = 'slate',
}) => (
  <div className="flex w-full min-w-0 flex-col gap-[2px]">
    <span
      className={cn(
        'ps-[4px] text-[10px] font-semibold uppercase tracking-wide',
        SUMMARY_LABEL_TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
    <p
      className={cn(
        'w-full min-w-0 break-words rounded-md border px-2 py-1.5 text-sm font-medium',
        SUMMARY_VALUE_TONE_CLASS[tone],
        mono && 'font-mono text-[13px]',
      )}
    >
      {value || '—'}
    </p>
  </div>
);

export const EdgeModelModelerColumnDialog: React.FC<EdgeModelModelerColumnDialogProps> = ({
  open,
  column,
  initialValues,
  belongsToAttach = null,
  lifecycleField = null,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<EdgeModelModelerColumnStudioForm | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [attachedFieldsError, setAttachedFieldsError] = useState<string | null>(null);
  const translate = useOptionalCultureT();
  const columnName = column?.name ?? null;

  useEffect(() => {
    if (!open || !columnName) {
      setForm(null);
      setIconPickerOpen(false);
      setAttachedFieldsError(null);
      return;
    }
    // Seed once per open/column; do not reset while editing if parent draft refreshes.
    setForm({
      ...initialValues,
      formWidgetProps: applyColumnFormWidgetPropDefaults(
        initialValues.formWidget,
        initialValues.formWidgetProps,
      ),
      relationFormWidget: belongsToAttach
        ? resolveBelongsToFormWidget(initialValues.relationFormWidget)
        : '',
      attachedFields: normalizeRelationAttachedFields(
        initialValues.attachedFields,
        belongsToAttach?.foreignKey ?? '',
      ),
    });
    setIconPickerOpen(false);
    setAttachedFieldsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: seed on open/column only
  }, [columnName, open]);

  if (!open || !column || !form) {
    return null;
  }

  const nullLabel = column.allowNull ? 'Nullable' : 'Not null';
  const iconLabel = form.icon.trim()
    ? formatNavigationIconRefLabel(form.icon)
    : 'No icon';
  const fieldName = column.name;
  const displayNameFormula = formatColumnDisplayNameFormula(fieldName);
  const displayNameUntouched = isColumnDisplayNameFormula(form.displayLabel, fieldName);
  const displayNameInputValue = displayNameUntouched ? displayNameFormula : form.displayLabel;
  const resolvedDisplayName = resolveColumnDisplayName(fieldName, translate, form.displayLabel);

  const requiredLocked = !column.allowNull;
  const requiredChecked = requiredLocked || form.required;

  const handleSave = () => {
    const attachedFields = belongsToAttach
      ? normalizeRelationAttachedFields(form.attachedFields, belongsToAttach.foreignKey)
      : [];
    if (belongsToAttach) {
      const attachError = validateRelationAttachedFields(
        attachedFields,
        belongsToAttach.foreignKey,
      );
      if (attachError) {
        setAttachedFieldsError(attachError);
        return;
      }
    }

    onSave({
      displayLabel: normalizeColumnDisplayLabelForStorage(fieldName, form.displayLabel),
      icon: form.icon.trim(),
      formWidget: belongsToAttach ? '' : form.formWidget,
      formWidgetProps: belongsToAttach
        ? createEmptyColumnFormWidgetProps()
        : applyColumnFormWidgetPropDefaults(form.formWidget, form.formWidgetProps),
      relationFormWidget: belongsToAttach
        ? resolveBelongsToFormWidget(form.relationFormWidget)
        : '',
      required: requiredLocked ? true : form.required,
      searchRole: form.searchRole,
      filterRole: form.filterRole,
      developerNotes: form.developerNotes,
      interfaceNotes: form.interfaceNotes,
      attachedFields,
      cubeMeasureEnabled: form.cubeMeasureEnabled,
      cubeAggregation: form.cubeAdditivity === 'semi-additive' ? 'lastNonEmpty' : form.cubeAggregation,
      cubeAdditivity: form.cubeAdditivity,
      cubeSemiAdditiveOver: form.cubeSemiAdditiveOver,
      history: form.history,
    });
    onClose();
  };

  const searchRoleLabel = COLUMN_SEARCH_ROLE_OPTIONS.find(
    (option) => option.value === form.searchRole,
  )?.label ?? COLUMN_SEARCH_ROLE_OPTIONS.find(
    (option) => option.value === DEFAULT_COLUMN_SEARCH_ROLE,
  )?.label ?? 'Not in search';

  const filterRoleLabel = COLUMN_FILTER_ROLE_OPTIONS.find(
    (option) => option.value === form.filterRole,
  )?.label ?? 'Public list filter';

  return (
    <>
      <FloatingPanelShell
        open={open}
        onClose={onClose}
        title="Column Properties"
        titleIcon={<Columns3 className="h-3.5 w-3.5 text-indigo-600" />}
        bounds={PANEL_BOUNDS}
        defaultWidth={960}
        defaultHeight={780}
        initialPosition="center"
        initialMaximized
        dragFromHeaderOnly
        enableDrag
        enableResize
        enableMaximize
        borderClassName={MODELER_PANEL_BORDER_COLUMN_CLASS}
        headerClassName={MODELER_FLOATING_PANEL_HEADER_CLASS}
        titleClassName={MODELER_FLOATING_PANEL_TITLE_CLASS}
        headerBand={(
          <div className={MODELER_FLOATING_PANEL_HEADER_BAND_CLASS}>
            {form.icon.trim() ? (
              <NavigationIcon iconRef={form.icon} className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
            ) : (
              <Columns3 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            )}
            <span className="truncate font-mono text-sm font-semibold text-slate-800">
              {column.name}
            </span>
            {column.isPrimaryKey ? (
              <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                <KeyRound className="h-3 w-3" aria-hidden="true" />
                PK
              </span>
            ) : null}
            {belongsToAttach ? (
              <span className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                FK
              </span>
            ) : null}
          </div>
        )}
        footer={(
          <div className="flex w-full items-center justify-end gap-2 px-3 py-2">
            <AppButton intent="secondary" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Close
            </AppButton>
            <AppButton intent="primary" size="sm" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </AppButton>
          </div>
        )}
      >
        <div className="flex h-full min-h-0 overflow-hidden !bg-white">
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-4 py-3"
            data-floating-panel-drag-exclude
          >
            <FormSection title="Labels" ink="accent" hint="How this column appears in lists and forms — display name and icon.">
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <FormField
                  label="Display Name"
                  hint={`Fixed default is ${displayNameFormula}. Untouched uses the culture translation for this field; if missing, underscores are removed and each word is capitalized (e.g. Order Date).`}
                  className="col-span-1 min-w-0 w-full"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block min-w-0 flex-1 font-mono"
                      value={displayNameInputValue}
                      onChange={(event) => {
                        const next = normalizeColumnDisplayLabelForStorage(fieldName, event.target.value);
                        setForm((current) => (current ? { ...current, displayLabel: next } : current));
                      }}
                      placeholder={displayNameFormula}
                      ariaLabel="Column display name"
                    />
                    {!displayNameUntouched ? (
                      <AppButton
                        type="button"
                        size="sm"
                        intent="secondary"
                        aria-label="Reset display name to translate formula"
                        onClick={() => setForm((current) => (
                          current ? { ...current, displayLabel: '' } : current
                        ))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </AppButton>
                    ) : null}
                  </div>
                </FormField>

                <div className="col-span-1 flex w-full min-w-0 items-start gap-3">
                  <FormField
                    label="Placeholder"
                    hint="Hint text shown inside the control when empty."
                    className="min-w-0 flex-1"
                  >
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block w-full min-w-0"
                      value={form.formWidgetProps.placeholder ?? ''}
                      onChange={(event) => setForm((current) => (
                        current
                          ? {
                            ...current,
                            formWidgetProps: {
                              ...current.formWidgetProps,
                              placeholder: event.target.value,
                            },
                          }
                          : current
                      ))}
                      ariaLabel="Column placeholder"
                    />
                  </FormField>

                  <FormField
                    label="Icon"
                    hint="Optional glyph shown on column chips and in this properties header."
                    className="w-auto shrink-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <AppButton
                        type="button"
                        size="sm"
                        intent="secondary"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center !px-0"
                        aria-label={form.icon.trim() ? `Column icon: ${iconLabel}` : 'Choose column icon'}
                        onClick={() => setIconPickerOpen(true)}
                      >
                        {form.icon.trim() ? (
                          <NavigationIcon iconRef={form.icon} className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                        )}
                      </AppButton>
                      {form.icon.trim() ? (
                        <AppButton
                          type="button"
                          size="sm"
                          intent="secondary"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center !px-0"
                          aria-label="Clear column icon"
                          onClick={() => setForm((current) => (
                            current ? { ...current, icon: '' } : current
                          ))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </AppButton>
                      ) : null}
                    </div>
                  </FormField>
                </div>
              </div>
            </FormSection>

            <FormSection title="Forms" ink="complement" divided hint="Widget, required flag, and search role when this column is used in generated forms and grids.">
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <FormField
                  label="List Search"
                  hint="Whether this column appears in the initial list search, only in advanced/more search, or not at all."
                  className="col-span-1 min-w-0 w-full"
                >
                  <UiSelect
                    size="sm"
                    className="block w-full min-w-0"
                    value={form.searchRole}
                    onChange={(event) => {
                      const next = event.target.value as ColumnSearchRole;
                      setForm((current) => (current ? { ...current, searchRole: next } : current));
                    }}
                    ariaLabel="Column list search participation"
                  >
                    {COLUMN_SEARCH_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField
                  label="List filter"
                  hint="Whether this column appears in List Where (advanced list filter)."
                  className="col-span-1 min-w-0 w-full"
                >
                  <UiSelect
                    size="sm"
                    className="block w-full min-w-0"
                    value={form.filterRole}
                    onChange={(event) => {
                      const next = event.target.value as ColumnFilterRole;
                      setForm((current) => (current ? { ...current, filterRole: next } : current));
                    }}
                    ariaLabel="Column list filter participation"
                  >
                    {COLUMN_FILTER_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField
                  label="Form Widget"
                  hint={
                    belongsToAttach
                      ? 'Picker control for the related record. Same catalog as Sandbox → Relations (Belongs to). Defaults to Select.'
                      : 'Display control for generated forms. Leave as Auto to infer from column type.'
                  }
                  className="col-span-1 min-w-0 w-full"
                >
                  {belongsToAttach ? (
                    <UiSelect
                      size="sm"
                      className="block w-full min-w-0"
                      value={resolveBelongsToFormWidget(form.relationFormWidget)}
                      onChange={(event) => {
                        const next = event.target.value as RelationFormWidget;
                        setForm((current) => (
                          current ? { ...current, relationFormWidget: next } : current
                        ));
                      }}
                      ariaLabel="Relation form widget"
                    >
                      {relationFormWidgetOptionsForKind('belongsTo').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </UiSelect>
                  ) : (
                    <UiSelect
                      size="sm"
                      className="block w-full min-w-0"
                      value={form.formWidget || COLUMN_FORM_WIDGET_AUTO_SELECT_VALUE}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const next = (
                          raw === COLUMN_FORM_WIDGET_AUTO_SELECT_VALUE
                            ? ''
                            : raw
                        ) as ColumnFormWidget | '';
                        setForm((current) => (
                          current
                            ? {
                              ...current,
                              formWidget: next,
                              formWidgetProps: applyColumnFormWidgetPropDefaults(
                                next,
                                current.formWidgetProps,
                              ),
                            }
                            : current
                        ));
                      }}
                      ariaLabel="Column form widget"
                    >
                      <option value={COLUMN_FORM_WIDGET_AUTO_SELECT_VALUE}>Auto (by type)</option>
                      {COLUMN_FORM_WIDGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </UiSelect>
                  )}
                </FormField>

                <FormField
                  label="Required"
                  hint={
                    requiredLocked
                      ? 'This column is not nullable, so it is always required in forms.'
                      : 'Whether this column must be filled in generated forms.'
                  }
                  className="col-span-1 min-w-0 w-full"
                >
                  <div
                    className={cn(
                      'flex w-full min-w-0 items-center px-2',
                      '!h-8 !min-h-8 rounded-[6px] border bg-white',
                      requiredChecked ? 'border-amber-300' : 'border-slate-300',
                      requiredLocked && 'opacity-60',
                    )}
                  >
                    <UiCheckbox
                      size="sm"
                      checked={requiredChecked}
                      disabled={requiredLocked}
                      onChange={(event) => {
                        if (requiredLocked) {
                          return;
                        }
                        const next = event.target.checked;
                        setForm((current) => (current ? { ...current, required: next } : current));
                      }}
                    >
                      Required in forms
                    </UiCheckbox>
                  </div>
                </FormField>

                {!belongsToAttach ? (
                  <div className="col-span-2 min-w-0 w-full">
                    <ColumnFormWidgetPropsFields
                      widget={form.formWidget}
                      value={form.formWidgetProps}
                      onChange={(formWidgetProps) => setForm((current) => (
                        current ? { ...current, formWidgetProps } : current
                      ))}
                    />
                  </div>
                ) : null}
              </div>
            </FormSection>

            <FormSection title="Notes" ink="contrast" divided hint="Developer and operator notes stored on studio metadata for this column.">
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <FormField
                  label="Developer Notes"
                  hint="Internal notes for builders — not shown to end users."
                  className="col-span-1 min-w-0 w-full"
                >
                  <UiTextarea
                    size="sm"
                    aiAssist={false}
                    className="block w-full min-w-0 resize-none !overflow-y-auto"
                    value={form.developerNotes}
                    onChange={(event) => setForm((current) => (
                      current ? { ...current, developerNotes: event.target.value } : current
                    ))}
                    ariaLabel="Column developer notes"
                    rows={2}
                  />
                </FormField>

                <FormField
                  label="Interface Notes"
                  hint="Operator-facing guidance for generated UIs, field help, and labels."
                  className="col-span-1 min-w-0 w-full"
                >
                  <UiTextarea
                    size="sm"
                    aiAssist={false}
                    className="block w-full min-w-0 resize-none !overflow-y-auto"
                    value={form.interfaceNotes}
                    onChange={(event) => setForm((current) => (
                      current ? { ...current, interfaceNotes: event.target.value } : current
                    ))}
                    ariaLabel="Column interface notes"
                    rows={2}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Cube measure" ink="accent" divided hint="Marks this column as a ROLAP stored measure for star-schema pivot.">
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <FormField label="Measure" className="col-span-2 min-w-0 w-full">
                  <UiCheckbox
                    size="sm"
                    checked={form.cubeMeasureEnabled}
                    onChange={(event) => setForm((current) => (
                      current ? { ...current, cubeMeasureEnabled: event.target.checked } : current
                    ))}
                  >
                    Use as cube measure
                  </UiCheckbox>
                </FormField>
                <FormField label="Aggregation" className="min-w-0 w-full">
                  <UiSelect
                    size="sm"
                    value={form.cubeAggregation}
                    onChange={(event) => setForm((current) => (
                      current
                        ? {
                          ...current,
                          cubeAggregation: event.target.value as EdgeModelModelerColumnStudioForm['cubeAggregation'],
                        }
                        : current
                    ))}
                    disabled={!form.cubeMeasureEnabled}
                    ariaLabel="Cube measure aggregation"
                  >
                    {['sum', 'count', 'avg', 'min', 'max', 'countDistinct', 'lastNonEmpty'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Additivity" className="min-w-0 w-full">
                  <UiSelect
                    size="sm"
                    value={form.cubeAdditivity}
                    onChange={(event) => setForm((current) => {
                      if (!current) return current;
                      const cubeAdditivity = event.target.value as EdgeModelModelerColumnStudioForm['cubeAdditivity'];
                      return {
                        ...current,
                        cubeAdditivity,
                        cubeAggregation: cubeAdditivity === 'semi-additive' ? 'lastNonEmpty' : current.cubeAggregation,
                      };
                    })}
                    disabled={!form.cubeMeasureEnabled}
                    ariaLabel="Cube measure additivity"
                  >
                    <option value="additive">additive</option>
                    <option value="semi-additive">semi-additive</option>
                  </UiSelect>
                </FormField>
                {form.cubeAdditivity === 'semi-additive' ? (
                  <FormField
                    label="Semi-additive over"
                    hint="Association alias of the time dimension."
                    className="col-span-2 min-w-0 w-full"
                  >
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block w-full min-w-0"
                      value={form.cubeSemiAdditiveOver}
                      disabled={!form.cubeMeasureEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeSemiAdditiveOver: event.target.value } : current
                      ))}
                      ariaLabel="Semi-additive time dimension association"
                      placeholder="period"
                    />
                  </FormField>
                ) : null}
              </div>
            </FormSection>

            <ColumnHistoryFields
              value={form.history}
              onChange={(history) => setForm((current) => (
                current ? { ...current, history } : current
              ))}
              isLifecycle={Boolean(lifecycleField && column.name === lifecycleField)}
            />

            {belongsToAttach ? (
              <EdgeModelBelongsToAttachedFieldsEditor
                foreignKey={belongsToAttach.foreignKey}
                associationAs={belongsToAttach.associationAs}
                targetModel={belongsToAttach.targetModel}
                value={form.attachedFields}
                error={attachedFieldsError}
                divided
                onChange={(attachedFields) => {
                  setAttachedFieldsError(null);
                  setForm((current) => (
                    current ? { ...current, attachedFields } : current
                  ));
                }}
              />
            ) : null}
          </div>

          <aside className="flex w-1/4 min-w-0 max-w-[25%] shrink-0 flex-col gap-3 overflow-x-hidden overflow-y-auto border-s border-slate-200 bg-slate-50/50 px-3 py-3 [&_>_*]:w-full">
            <p className="ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Schema summary
            </p>
            <SummaryRow label="Column" value={column.name} mono tone="indigo" />
            <SummaryRow label="Field" value={column.field} mono tone="slate" />
            <SummaryRow label="Resolved label" value={resolvedDisplayName} tone="violet" />
            <SummaryRow label="Native type" value={column.dataType} mono tone="cyan" />
            <SummaryRow label="Runtime type" value={column.sequelizeType} mono tone="cyan" />
            <SummaryRow
              label="Null"
              value={nullLabel}
              tone={column.allowNull ? 'emerald' : 'amber'}
            />
            <SummaryRow label="List search" value={searchRoleLabel} tone="slate" />
            <SummaryRow label="List filter" value={filterRoleLabel} tone="slate" />
          </aside>
        </div>
      </FloatingPanelShell>

      <NavigationIconPickerDialog
        open={iconPickerOpen}
        selectedIcon={form.icon.trim() || undefined}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(iconRef) => {
          setForm((current) => (current ? { ...current, icon: iconRef } : current));
          setIconPickerOpen(false);
        }}
      />
    </>
  );
};
