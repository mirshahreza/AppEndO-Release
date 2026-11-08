import React, { useEffect, useState } from 'react';
import { ImageIcon, Save, Waypoints, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  EdgeModelColumn,
  EdgeModelStudioAssociationMeta,
  RelationFormWidget,
  RelationTargetFilterCondition,
} from '../../../shared/api/contracts/data-api';
import {
  RELATION_FORM_WIDGET_AUTO_SELECT_VALUE,
  RELATION_FORM_WIDGET_LABEL_BY_VALUE,
  defaultRelationFormWidgetLabel,
  formatRelationTargetFilterCondition,
  normalizeRelationTargetFilter,
  relationFormWidgetOptionsForKind,
  resolveRelationFormWidgetForKind,
  type RelationWidgetKindHint,
} from '../../../shared/api/contracts/data-api';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import { schemaRelationLabelClassName } from '../../../shared/lib/schemaRelationEdgeStyles';
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
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import {
  MODELER_FLOATING_PANEL_HEADER_BAND_CLASS,
  MODELER_FLOATING_PANEL_HEADER_CLASS,
  MODELER_FLOATING_PANEL_TITLE_CLASS,
  MODELER_PANEL_BORDER_RELATION_CLASS,
} from '../lib/modelerChipStyles';
import type { RelationsDatasheetRow } from '../lib/relationsDatasheetRows';
import { EdgeModelRelationTargetFilterEditor } from './EdgeModelRelationTargetFilterEditor';
import {
  AssociationHistoryFields,
  associationHistoryFromMeta,
  emptyAssociationHistoryForm,
  pruneAssociationHistory,
  type AssociationHistoryForm,
} from './EdgeModelHistoryFields';

const PANEL_BOUNDS = {
  minWidth: 720,
  maxWidth: 1280,
  minHeight: 700,
  maximizeInset: 24,
};

export type EdgeModelModelerRelationStudioForm = {
  displayLabel: string;
  icon: string;
  formWidget: RelationFormWidget | '';
  targetFilter: RelationTargetFilterCondition[];
  developerNotes: string;
  interfaceNotes: string;
  cubeDimensionEnabled: boolean;
  cubeIsTimeDimension: boolean;
  cubeHierarchyName: string;
  cubeHierarchyLevels: string;
  cubeAttributes: string;
  history: AssociationHistoryForm;
};

const parseCsvFields = (value: string): string[] => (
  value.split(',').map((item) => item.trim()).filter(Boolean)
);

export const cubeDimensionFromRelationForm = (
  form: Pick<
    EdgeModelModelerRelationStudioForm,
    'cubeDimensionEnabled' | 'cubeIsTimeDimension' | 'cubeHierarchyName' | 'cubeHierarchyLevels' | 'cubeAttributes'
  >,
): NonNullable<EdgeModelStudioAssociationMeta['cubeDimension']> | null => {
  if (!form.cubeDimensionEnabled) {
    return null;
  }
  const levels = parseCsvFields(form.cubeHierarchyLevels);
  const attributes = parseCsvFields(form.cubeAttributes);
  if (levels.length === 0 && attributes.length === 0) {
    return null;
  }
  return {
    ...(levels.length > 0
      ? { hierarchies: [{ name: form.cubeHierarchyName.trim() || 'Default', levels }] }
      : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(form.cubeIsTimeDimension ? { isTimeDimension: true } : {}),
  };
};

const kindHintForRow = (row: RelationsDatasheetRow): RelationWidgetKindHint => {
  if (row.nature === 'physical') {
    return 'physical';
  }
  return row.association.kind;
};

export type EdgeModelModelerRelationDialogProps = {
  open: boolean;
  row: RelationsDatasheetRow | null;
  /** Target model columns for belongs-to allowed-row filters. */
  targetColumns?: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'dataType'>>;
  initialValues: EdgeModelModelerRelationStudioForm;
  onSave: (values: EdgeModelModelerRelationStudioForm) => void;
  onClose: () => void;
};

type SummaryRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  /** Split ` · `-joined rules onto separate lines (e.g. cascade). */
  stackedRules?: boolean;
};

const SummaryRow: React.FC<SummaryRowProps> = ({
  label,
  value,
  mono = false,
  stackedRules = false,
}) => {
  const lines = stackedRules
    ? value.split(' · ').map((part) => part.trim()).filter(Boolean)
    : [value || '—'];

  return (
    <div className="flex w-full min-w-0 flex-col gap-[2px]">
      <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div
        className={cn(
          'w-full min-w-0 break-words rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-800',
          mono && 'font-mono text-[13px]',
          stackedRules && lines.length > 1 && 'flex flex-col gap-1',
        )}
      >
        {lines.length > 0 ? lines.map((line) => (
          <p key={line} className="m-0 min-w-0 break-words leading-snug">
            {line}
          </p>
        )) : (
          <p className="m-0">—</p>
        )}
      </div>
    </div>
  );
};

const natureLabel = (nature: RelationsDatasheetRow['nature']): string => (
  nature === 'logical' ? 'Logical' : 'Physical'
);

export const EdgeModelModelerRelationDialog: React.FC<EdgeModelModelerRelationDialogProps> = ({
  open,
  row,
  targetColumns = [],
  initialValues,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<EdgeModelModelerRelationStudioForm | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const rowKey = row?.key ?? null;

  useEffect(() => {
    if (!open || !rowKey) {
      setForm(null);
      setIconPickerOpen(false);
      return;
    }
    setForm({ ...initialValues });
    setIconPickerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on open/row only
  }, [open, rowKey]);

  if (!open || !row || !form) {
    return null;
  }

  // Belongs-to picker widget is edited on the FK column (Column Properties), not here.
  const isBelongsTo = row.nature !== 'physical' && row.association.kind === 'belongsTo';
  const kindHint = kindHintForRow(row);
  const autoWidgetLabel = defaultRelationFormWidgetLabel(kindHint);
  // Selectable items = Sandbox → Relations catalog for this kind only (no cross-kind orphans).
  const widgetOptions = isBelongsTo ? [] : relationFormWidgetOptionsForKind(kindHint);
  const resolvedFormWidget = isBelongsTo
    ? form.formWidget
    : resolveRelationFormWidgetForKind(kindHint, form.formWidget);
  const selectedWidgetLabel = resolvedFormWidget
    ? (RELATION_FORM_WIDGET_LABEL_BY_VALUE[resolvedFormWidget] ?? resolvedFormWidget)
    : `Auto (${autoWidgetLabel})`;

  const iconLabel = form.icon.trim()
    ? formatNavigationIconRefLabel(form.icon)
    : 'No icon';
  const resolvedLabel = form.displayLabel.trim() || row.name;
  const associationAs = row.nature !== 'physical' ? row.association.as : null;
  const foreignKey = row.nature !== 'physical' ? row.association.foreignKey : null;
  const throughLabel = row.nature !== 'physical'
    && row.association.kind === 'belongsToMany'
    ? `${row.association.throughModelId} · ${row.association.foreignKey} / ${row.association.otherKey}`
    : null;

  const normalizedTargetFilter = normalizeRelationTargetFilter(form.targetFilter);
  const targetFilterSummary = normalizedTargetFilter.length > 0
    ? normalizedTargetFilter.map(formatRelationTargetFilterCondition).join(' · ')
    : 'All rows';

  const handleSave = () => {
    onSave({
      displayLabel: form.displayLabel.trim(),
      icon: form.icon.trim(),
      // Preserve column-owned widget for belongs-to; do not clear via this dialog.
      // Other kinds: persist only Sandbox → Relations options for this kind.
      formWidget: isBelongsTo
        ? initialValues.formWidget
        : resolveRelationFormWidgetForKind(kindHint, form.formWidget),
      targetFilter: isBelongsTo ? normalizedTargetFilter : initialValues.targetFilter,
      developerNotes: form.developerNotes,
      interfaceNotes: form.interfaceNotes,
      cubeDimensionEnabled: form.cubeDimensionEnabled,
      cubeIsTimeDimension: form.cubeIsTimeDimension,
      cubeHierarchyName: form.cubeHierarchyName,
      cubeHierarchyLevels: form.cubeHierarchyLevels,
      cubeAttributes: form.cubeAttributes,
      history: form.history,
    });
    onClose();
  };

  return (
    <>
      <FloatingPanelShell
        open={open}
        onClose={onClose}
        title="Relation Properties"
        titleIcon={<Waypoints className="h-3.5 w-3.5 text-violet-600" />}
        bounds={PANEL_BOUNDS}
        defaultWidth={960}
        defaultHeight={820}
        initialPosition="center"
        dragFromHeaderOnly
        enableDrag
        enableResize
        enableMaximize
        borderClassName={MODELER_PANEL_BORDER_RELATION_CLASS}
        headerClassName={MODELER_FLOATING_PANEL_HEADER_CLASS}
        titleClassName={MODELER_FLOATING_PANEL_TITLE_CLASS}
        headerBand={(
          <div className={MODELER_FLOATING_PANEL_HEADER_BAND_CLASS}>
            {form.icon.trim() ? (
              <NavigationIcon iconRef={form.icon} className="h-3.5 w-3.5 shrink-0 text-violet-600" />
            ) : null}
            <span className="truncate font-mono text-sm font-semibold text-slate-800">
              {row.name}
            </span>
            <span className="truncate text-[11px] font-medium text-slate-500">
              {row.kindLabel}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-100">
              {natureLabel(row.nature)}
            </span>
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
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-3"
            data-floating-panel-drag-exclude
          >
            <div className="grid w-full min-w-0 grid-cols-2 gap-3">
              <FormField
                label="Display Name"
                hint="Label used in generated interfaces. Leave empty to use the relation name."
                className="col-span-1 min-w-0 w-full"
              >
                <UiInput
                  size="sm"
                  aiAssist={false}
                  className="block w-full min-w-0"
                  value={form.displayLabel}
                  onChange={(event) => setForm((current) => (
                    current ? { ...current, displayLabel: event.target.value } : current
                  ))}
                  placeholder={row.name}
                  ariaLabel="Relation display name"
                />
              </FormField>

              <FormField
                label="Icon"
                hint="Optional glyph shown on relation badges and in this properties header."
                className="col-span-1 min-w-0 w-full"
              >
                <div className="flex items-center gap-1.5">
                  <AppButton
                    type="button"
                    size="sm"
                    intent="secondary"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center !px-0"
                    aria-label={form.icon.trim() ? `Relation icon: ${iconLabel}` : 'Choose relation icon'}
                    onClick={() => setIconPickerOpen(true)}
                  >
                    {form.icon.trim() ? (
                      <NavigationIcon iconRef={form.icon} className="h-4 w-4" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                    )}
                  </AppButton>
                  {form.icon.trim() ? (
                    <AppButton
                      type="button"
                      size="sm"
                      intent="secondary"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center !px-0"
                      aria-label="Clear relation icon"
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
                  ariaLabel="Relation developer notes"
                  rows={4}
                />
              </FormField>

              <FormField
                label="Interface Notes"
                hint="Operator-facing guidance for generated UIs, pickers, and related lists."
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
                  ariaLabel="Relation interface notes"
                  rows={4}
                />
              </FormField>
            </div>

            {row.nature !== 'physical' ? (
              <FormSection
                title="Cube dimension"
                ink="accent"
                divided
                hint="Marks this association as a ROLAP dimension for star-schema pivot. Declare a hierarchy or attributes."
              >
                <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                  <FormField label="Dimension" className="col-span-2 min-w-0 w-full">
                    <UiCheckbox
                      size="sm"
                      checked={form.cubeDimensionEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeDimensionEnabled: event.target.checked } : current
                      ))}
                    >
                      Use as cube dimension
                    </UiCheckbox>
                  </FormField>
                  <FormField label="Time dimension" className="col-span-2 min-w-0 w-full">
                    <UiCheckbox
                      size="sm"
                      checked={form.cubeIsTimeDimension}
                      disabled={!form.cubeDimensionEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeIsTimeDimension: event.target.checked } : current
                      ))}
                    >
                      Time dimension (semi-additive lastNonEmpty)
                    </UiCheckbox>
                  </FormField>
                  <FormField label="Hierarchy name" className="min-w-0 w-full">
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block w-full min-w-0"
                      value={form.cubeHierarchyName}
                      disabled={!form.cubeDimensionEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeHierarchyName: event.target.value } : current
                      ))}
                      ariaLabel="Cube hierarchy name"
                      placeholder="Default"
                    />
                  </FormField>
                  <FormField
                    label="Hierarchy levels"
                    hint="Comma-separated target column names, coarse to fine."
                    className="min-w-0 w-full"
                  >
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block w-full min-w-0"
                      value={form.cubeHierarchyLevels}
                      disabled={!form.cubeDimensionEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeHierarchyLevels: event.target.value } : current
                      ))}
                      ariaLabel="Cube hierarchy levels"
                      placeholder="region, city"
                    />
                  </FormField>
                  <FormField
                    label="Attributes"
                    hint="Comma-separated target columns that are not hierarchy levels."
                    className="col-span-2 min-w-0 w-full"
                  >
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      className="block w-full min-w-0"
                      value={form.cubeAttributes}
                      disabled={!form.cubeDimensionEnabled}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, cubeAttributes: event.target.value } : current
                      ))}
                      ariaLabel="Cube dimension attributes"
                      placeholder="code, iso"
                    />
                  </FormField>
                </div>
              </FormSection>
            ) : null}

            <AssociationHistoryFields
              value={form.history}
              onChange={(history) => setForm((current) => (
                current ? { ...current, history } : current
              ))}
            />

            {!isBelongsTo ? (
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <FormField
                  label="Form Widget"
                  hint={`Same catalog as Sandbox → Relations for this kind. Auto uses ${autoWidgetLabel}.`}
                  className="col-span-1 min-w-0 w-full"
                >
                  <UiSelect
                    size="sm"
                    className="block w-full min-w-0"
                    value={resolvedFormWidget || RELATION_FORM_WIDGET_AUTO_SELECT_VALUE}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const next = (
                        raw === RELATION_FORM_WIDGET_AUTO_SELECT_VALUE
                          ? ''
                          : resolveRelationFormWidgetForKind(
                            kindHint,
                            raw as RelationFormWidget,
                          )
                      );
                      setForm((current) => (
                        current ? { ...current, formWidget: next } : current
                      ));
                    }}
                    ariaLabel="Relation form widget"
                  >
                    <option value={RELATION_FORM_WIDGET_AUTO_SELECT_VALUE}>
                      {`Auto (${autoWidgetLabel})`}
                    </option>
                    {widgetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            ) : null}

            {isBelongsTo ? (
              <EdgeModelRelationTargetFilterEditor
                targetColumns={targetColumns}
                value={form.targetFilter}
                onChange={(targetFilter) => setForm((current) => (
                  current ? { ...current, targetFilter } : current
                ))}
                divided
              />
            ) : null}
          </div>

          <aside className="flex w-1/4 min-w-0 max-w-[25%] shrink-0 flex-col gap-3 overflow-x-hidden overflow-y-auto border-s border-slate-200 bg-slate-50/50 px-3 py-3 [&_>_*]:w-full">
            <SummaryRow label="Name" value={row.name} mono />
            <SummaryRow label="Resolved label" value={resolvedLabel} />
            {!isBelongsTo ? (
              <SummaryRow label="Form widget" value={selectedWidgetLabel} />
            ) : (
              <SummaryRow label="Allowed rows" value={targetFilterSummary} mono stackedRules />
            )}
            <SummaryRow label="Type" value={row.kindLabel} />
            <div className="flex w-full min-w-0 flex-col gap-[2px]">
              <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Nature
              </span>
              <div className="flex min-h-[2.125rem] items-center rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <span
                  className={cn(
                    'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    schemaRelationLabelClassName(row.nature),
                  )}
                >
                  {natureLabel(row.nature)}
                </span>
              </div>
            </div>
            <SummaryRow label="From" value={row.fromLabel} mono />
            <SummaryRow label="To" value={row.toLabel} mono />
            {row.cascadeLabel ? (
              <SummaryRow label="Cascade" value={row.cascadeLabel} mono stackedRules />
            ) : null}
            {associationAs ? (
              <SummaryRow label="Include alias" value={associationAs} mono />
            ) : null}
            {foreignKey ? (
              <SummaryRow label="Foreign key" value={foreignKey} mono />
            ) : null}
            {throughLabel ? (
              <SummaryRow label="Through" value={throughLabel} mono />
            ) : null}
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
