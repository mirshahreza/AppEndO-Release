import * as React from 'react';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { listDesignerModalNodes } from '../../../domain/component-designer/bindingGridDetailEngine';
import type { DesignerDataGridColumn } from '../../../domain/component-designer/designerDataGridColumns';
import type { DesignerGridRowActionBehavior, DesignerGridRowActionBehaviorKind } from '../../../domain/component-designer/designerGridActionColumns';
import {
  defaultRichCellFieldsForKind,
  DESIGNER_GRID_CHIP_COLOR_MODE_OPTIONS,
  DESIGNER_GRID_RICH_CELL_KIND_OPTIONS,
  isRichCellKind,
  richCellKindSupportsClick,
  type DesignerGridChipColorMode,
  type DesignerGridLookupEntry,
  type DesignerGridRichCellFields,
  type DesignerGridRichCellKind,
} from '../../../domain/component-designer/designerGridRichCellColumns';
import { UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { InspectorGridDisableRuleFields } from './InspectorGridDisableRuleFields';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorFieldGroup, InspectorMicroLabel } from './inspectorFieldPrimitives';

type InspectorGridRichCellFieldsProps = {
  node: DesignerNode;
  document: DesignerDocument;
  column: DesignerDataGridColumn;
  columnIndex: number;
  onChange: (patch: Partial<DesignerDataGridColumn>) => void;
  bindingDefinitions?: DesignerBindingDefinitions;
};

const BEHAVIOR_OPTIONS: ReadonlyArray<{ value: DesignerGridRowActionBehaviorKind; label: string }> = [
  { value: 'none', label: 'No behavior (preview only)' },
  { value: 'detail-flow', label: 'Use grid detail flow' },
  { value: 'open-modal', label: 'Open modal' },
];

const readBehavior = (behavior: DesignerGridRowActionBehavior | undefined): DesignerGridRowActionBehavior => ({
  kind: behavior?.kind ?? 'none',
  modalNodeId: behavior?.modalNodeId,
  primaryKeyField: behavior?.primaryKeyField,
  selectionStorePath: behavior?.selectionStorePath,
});

const FieldMappingInput: React.FC<{
  label: string;
  value?: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}> = ({ label, value, onChange, ariaLabel }) => (
  <div className="flex flex-col gap-[2px]">
    <InspectorMicroLabel>{label}</InspectorMicroLabel>
    <UiInput
      size="md"
      nested
      className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      ariaLabel={ariaLabel}
    />
  </div>
);

const CellClickBehaviorFields: React.FC<{
  nodeId: string;
  columnKey: string;
  behavior: DesignerGridRowActionBehavior | undefined;
  actionId?: string;
  modalNodes: DesignerNode[];
  onBehaviorChange: (behavior: DesignerGridRowActionBehavior) => void;
  onActionIdChange: (actionId: string | undefined) => void;
}> = ({
  nodeId,
  columnKey,
  behavior,
  actionId,
  modalNodes,
  onBehaviorChange,
  onActionIdChange,
}) => {
  const resolved = readBehavior(behavior);

  return (
    <div className={`col-span-2 flex flex-col gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
      <FieldMappingInput
        label="Cell click action id (optional)"
        value={actionId}
        onChange={(value) => onChangeActionId(value, onActionIdChange)}
        ariaLabel={`${nodeId}:${columnKey}:cell-click-action-id`}
      />
      <div className="flex flex-col gap-[2px]">
        <InspectorMicroLabel>On click</InspectorMicroLabel>
        <UiSelect
          size="md"
          nested
          className="w-full bg-white text-slate-700"
          value={resolved.kind}
          onChange={(event) => {
            const nextKind = event.target.value as DesignerGridRowActionBehaviorKind;
            onBehaviorChange({
              kind: nextKind,
              ...(nextKind === 'open-modal' && modalNodes[0]
                ? { modalNodeId: modalNodes[0].id }
                : {}),
            });
          }}
        >
          {BEHAVIOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </div>

      {resolved.kind === 'open-modal' ? (
        <>
          <div className="flex flex-col gap-[2px]">
            <InspectorMicroLabel>Modal</InspectorMicroLabel>
            <UiSelect
              size="md"
              nested
              className="w-full bg-white text-slate-700"
              value={resolved.modalNodeId ?? ''}
              onChange={(event) => onBehaviorChange({
                ...resolved,
                modalNodeId: event.target.value,
              })}
            >
              <option value="">Select modal…</option>
              {modalNodes.map((modalNode) => (
                <option key={modalNode.id} value={modalNode.id}>
                  {typeof modalNode.props.title === 'string' && modalNode.props.title.trim().length > 0
                    ? modalNode.props.title
                    : modalNode.id}
                </option>
              ))}
            </UiSelect>
          </div>
          <FieldMappingInput
            label="Row key field"
            value={resolved.primaryKeyField ?? 'id'}
            onChange={(value) => onBehaviorChange({ ...resolved, primaryKeyField: value })}
            ariaLabel={`${nodeId}:${columnKey}:cell-click-primary-key`}
          />
          <FieldMappingInput
            label="Selection store path"
            value={resolved.selectionStorePath ?? 'selection.id'}
            onChange={(value) => onBehaviorChange({ ...resolved, selectionStorePath: value })}
            ariaLabel={`${nodeId}:${columnKey}:cell-click-selection-path`}
          />
        </>
      ) : null}
    </div>
  );
};

const onChangeActionId = (
  value: string,
  onActionIdChange: (actionId: string | undefined) => void,
) => {
  const trimmed = value.trim();
  onActionIdChange(trimmed.length > 0 ? trimmed : undefined);
};

const updateCellFields = (
  current: DesignerGridRichCellFields | undefined,
  patch: Partial<DesignerGridRichCellFields>,
  onChange: (patch: Partial<DesignerDataGridColumn>) => void,
) => {
  const next: DesignerGridRichCellFields = {
    ...(current ?? {}),
    ...patch,
  };

  // Explicit clears: undefined in patch removes the key.
  for (const key of Object.keys(patch) as Array<keyof DesignerGridRichCellFields>) {
    if (patch[key] === undefined) {
      delete next[key];
    }
  }

  onChange({
    cellFields: next,
  });
};

const serializeLookupEntriesJson = (entries: DesignerGridLookupEntry[] | undefined): string => {
  if (!entries || entries.length === 0) {
    return '';
  }
  return JSON.stringify(entries, null, 2);
};

const parseLookupEntriesJson = (raw: string): DesignerGridLookupEntry[] | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    const entries = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const value = typeof record.value === 'string' ? record.value.trim() : '';
        if (!value) {
          return null;
        }
        const label = typeof record.label === 'string' && record.label.trim()
          ? record.label.trim()
          : value;
        const uiHtml = typeof record.uiHtml === 'string' && record.uiHtml.trim()
          ? record.uiHtml.trim()
          : undefined;
        return {
          value,
          label,
          ...(uiHtml ? { uiHtml } : {}),
        } satisfies DesignerGridLookupEntry;
      })
      .filter((entry): entry is DesignerGridLookupEntry => entry !== null);
    return entries.length > 0 ? entries : undefined;
  } catch {
    return undefined;
  }
};

const renderFieldMappings = (
  cellKind: DesignerGridRichCellKind,
  column: DesignerDataGridColumn,
  nodeId: string,
  onChange: (patch: Partial<DesignerDataGridColumn>) => void,
  lovOptions: ReadonlyArray<{ id: string; name: string }>,
): React.ReactNode => {
  const fields = column.cellFields ?? {};

  switch (cellKind) {
    case 'avatar':
      return (
        <>
          <FieldMappingInput
            label="Image URL field"
            value={fields.imageUrlField}
            onChange={(value) => updateCellFields(column.cellFields, { imageUrlField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:avatar-image-field`}
          />
          <FieldMappingInput
            label="Fallback text field"
            value={fields.fallbackTextField}
            onChange={(value) => updateCellFields(column.cellFields, { fallbackTextField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:avatar-fallback-field`}
          />
        </>
      );
    case 'file-tile':
      return (
        <>
          <FieldMappingInput
            label="Preview URL field"
            value={fields.previewUrlField}
            onChange={(value) => updateCellFields(column.cellFields, { previewUrlField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:file-tile-preview-field`}
          />
          <FieldMappingInput
            label="File name field"
            value={fields.fileNameField}
            onChange={(value) => updateCellFields(column.cellFields, { fileNameField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:file-tile-name-field`}
          />
          <FieldMappingInput
            label="MIME field"
            value={fields.mimeField}
            onChange={(value) => updateCellFields(column.cellFields, { mimeField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:file-tile-mime-field`}
          />
        </>
      );
    case 'account':
      return (
        <>
          <FieldMappingInput
            label="Primary field (email)"
            value={fields.primaryField}
            onChange={(value) => updateCellFields(column.cellFields, { primaryField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:account-primary-field`}
          />
          <FieldMappingInput
            label="Secondary field (username)"
            value={fields.secondaryField}
            onChange={(value) => updateCellFields(column.cellFields, { secondaryField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:account-secondary-field`}
          />
          <FieldMappingInput
            label="Badge field (built-in)"
            value={fields.badgeField}
            onChange={(value) => updateCellFields(column.cellFields, { badgeField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:account-badge-field`}
          />
        </>
      );
    case 'link':
      return (
        <>
          <FieldMappingInput
            label="Label field"
            value={fields.labelField}
            onChange={(value) => updateCellFields(column.cellFields, { labelField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:link-label-field`}
          />
          <FieldMappingInput
            label="Label fallback field"
            value={fields.labelFallbackField}
            onChange={(value) => updateCellFields(column.cellFields, { labelFallbackField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:link-fallback-field`}
          />
        </>
      );
    case 'icon-from-lookup':
      return (
        <>
          <FieldMappingInput
            label="Value field"
            value={fields.valueField}
            onChange={(value) => updateCellFields(column.cellFields, { valueField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:icon-lookup-value-field`}
          />
          <div className="flex flex-col gap-[2px]">
            <InspectorMicroLabel>Lookup source (LOV)</InspectorMicroLabel>
            <UiSelect
              size="sm"
              nested
              className="w-full bg-white text-slate-700"
              value={fields.lookupSource ?? ''}
              onChange={(event) => updateCellFields(column.cellFields, {
                lookupSource: event.target.value,
              }, onChange)}
              ariaLabel={`${nodeId}:${column.key}:icon-lookup-source`}
            >
              <option value="">Select LOV…</option>
              {lovOptions.map((lov) => (
                <option key={lov.id} value={lov.id}>{lov.name || lov.id}</option>
              ))}
            </UiSelect>
          </div>
          <FieldMappingInput
            label="Fallback Lucide icon"
            value={fields.fallbackIcon}
            onChange={(value) => updateCellFields(column.cellFields, { fallbackIcon: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:icon-lookup-fallback`}
          />
          <FieldMappingInput
            label="Row HTML field (enrichment fallback)"
            value={fields.htmlField}
            onChange={(value) => updateCellFields(column.cellFields, { htmlField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:icon-lookup-html-field`}
          />
          <FieldMappingInput
            label="Row label field (enrichment fallback)"
            value={fields.labelField}
            onChange={(value) => updateCellFields(column.cellFields, { labelField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:icon-lookup-label-field`}
          />
          <div className="col-span-2 flex flex-col gap-[2px]">
            <InspectorMicroLabel>Tooltip</InspectorMicroLabel>
            <UiSelect
              size="sm"
              nested
              className="w-full bg-white text-slate-700"
              value={fields.showTooltip !== false ? 'yes' : 'no'}
              onChange={(event) => updateCellFields(column.cellFields, {
                showTooltip: event.target.value === 'yes',
              }, onChange)}
              ariaLabel={`${nodeId}:${column.key}:icon-lookup-show-tooltip`}
            >
              <option value="yes">yes</option>
              <option value="no">no</option>
            </UiSelect>
          </div>
          <div className="col-span-2 flex flex-col gap-[2px]">
            <InspectorMicroLabel>
              Lookup entries (JSON array of value / label / uiHtml)
            </InspectorMicroLabel>
            <UiTextarea
              size="sm"
              nested
              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
              rows={4}
              value={serializeLookupEntriesJson(fields.lookupEntries)}
              onChange={(event) => {
                const nextEntries = parseLookupEntriesJson(event.target.value);
                updateCellFields(column.cellFields, {
                  lookupEntries: nextEntries,
                }, onChange);
              }}
              ariaLabel={`${nodeId}:${column.key}:icon-lookup-entries`}
              autoDir={false}
            />
          </div>
        </>
      );
    case 'chips':
      return (
        <>
          <FieldMappingInput
            label="Values field (array)"
            value={fields.valuesField}
            onChange={(value) => updateCellFields(column.cellFields, { valuesField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:chips-values-field`}
          />
          <div className="flex flex-col gap-[2px]">
            <InspectorMicroLabel>Color mode</InspectorMicroLabel>
            <UiSelect
              size="sm"
              nested
              className="w-full bg-white text-slate-700"
              value={fields.colorMode ?? 'fixed-two-tone'}
              onChange={(event) => updateCellFields(column.cellFields, {
                colorMode: event.target.value as DesignerGridChipColorMode,
              }, onChange)}
              ariaLabel={`${nodeId}:${column.key}:chips-color-mode`}
            >
              {DESIGNER_GRID_CHIP_COLOR_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>
          <FieldMappingInput
            label="Truncate label chars"
            value={fields.truncateLabelChars != null ? String(fields.truncateLabelChars) : ''}
            onChange={(value) => {
              const trimmed = value.trim();
              const parsed = trimmed.length > 0 ? Number(trimmed) : undefined;
              updateCellFields(column.cellFields, {
                truncateLabelChars: parsed != null && Number.isFinite(parsed) && parsed > 0
                  ? Math.floor(parsed)
                  : undefined,
              }, onChange);
            }}
            ariaLabel={`${nodeId}:${column.key}:chips-truncate-chars`}
          />
          <div className="col-span-2 flex flex-col gap-1">
            <div className="flex flex-col gap-[2px]">
              <InspectorMicroLabel>Truncate tooltip</InspectorMicroLabel>
              <UiSelect
                size="sm"
                nested
                className="w-full bg-white text-slate-700"
                value={fields.showTooltipOnTruncate === true ? 'yes' : 'no'}
                onChange={(event) => updateCellFields(column.cellFields, {
                  showTooltipOnTruncate: event.target.value === 'yes',
                }, onChange)}
                ariaLabel={`${nodeId}:${column.key}:chips-tooltip-truncate`}
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </UiSelect>
            </div>
            <div className="flex flex-col gap-[2px]">
              <InspectorMicroLabel>Overlap chips</InspectorMicroLabel>
              <UiSelect
                size="sm"
                nested
                className="w-full bg-white text-slate-700"
                value={fields.overlapMode === true ? 'yes' : 'no'}
                onChange={(event) => updateCellFields(column.cellFields, {
                  overlapMode: event.target.value === 'yes',
                }, onChange)}
                ariaLabel={`${nodeId}:${column.key}:chips-overlap`}
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </UiSelect>
            </div>
          </div>
        </>
      );
    case 'audit':
      return (
        <>
          <FieldMappingInput
            label="Date field"
            value={fields.dateField}
            onChange={(value) => updateCellFields(column.cellFields, { dateField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:audit-date-field`}
          />
          <FieldMappingInput
            label="Secondary date field"
            value={fields.secondaryDateField}
            onChange={(value) => updateCellFields(column.cellFields, { secondaryDateField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:audit-secondary-date-field`}
          />
          <FieldMappingInput
            label="Actor username field"
            value={fields.actorUsernameField}
            onChange={(value) => updateCellFields(column.cellFields, { actorUsernameField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:audit-actor-username-field`}
          />
          <FieldMappingInput
            label="Actor id field"
            value={fields.actorIdField}
            onChange={(value) => updateCellFields(column.cellFields, { actorIdField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:audit-actor-id-field`}
          />
        </>
      );
    case 'lock-status':
      return (
        <>
          <FieldMappingInput
            label="Locked field"
            value={fields.lockedField}
            onChange={(value) => updateCellFields(column.cellFields, { lockedField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-locked-field`}
          />
          <FieldMappingInput
            label="Locked at field"
            value={fields.lockedAtField}
            onChange={(value) => updateCellFields(column.cellFields, { lockedAtField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-locked-at-field`}
          />
          <FieldMappingInput
            label="Locked by username field"
            value={fields.lockedByUsernameField}
            onChange={(value) => updateCellFields(column.cellFields, { lockedByUsernameField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-locked-by-username-field`}
          />
          <FieldMappingInput
            label="Locked by id field"
            value={fields.lockedByField}
            onChange={(value) => updateCellFields(column.cellFields, { lockedByField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-locked-by-field`}
          />
          <FieldMappingInput
            label="Unlocked at field"
            value={fields.unlockedAtField}
            onChange={(value) => updateCellFields(column.cellFields, { unlockedAtField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-unlocked-at-field`}
          />
          <FieldMappingInput
            label="Unlocked by username field"
            value={fields.unlockedByUsernameField}
            onChange={(value) => updateCellFields(column.cellFields, { unlockedByUsernameField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-unlocked-by-username-field`}
          />
          <FieldMappingInput
            label="Unlocked by id field"
            value={fields.unlockedByField}
            onChange={(value) => updateCellFields(column.cellFields, { unlockedByField: value }, onChange)}
            ariaLabel={`${nodeId}:${column.key}:lock-unlocked-by-field`}
          />
        </>
      );
    default:
      return null;
  }
};

export const InspectorGridRichCellFields: React.FC<InspectorGridRichCellFieldsProps> = ({
  node,
  document,
  column,
  onChange,
  bindingDefinitions,
}) => {
  const cellKind = isRichCellKind(column.cellKind) ? column.cellKind : undefined;
  const modalNodes = React.useMemo(() => listDesignerModalNodes(document), [document]);
  const lovOptions = React.useMemo(
    () => Object.entries(bindingDefinitions?.lovs ?? {}).map(([id, lov]) => ({
      id,
      name: lov.name || id,
    })),
    [bindingDefinitions?.lovs],
  );

  if (!cellKind) {
    return null;
  }

  return (
    <InspectorFieldGroup columns={2} className="border-t border-slate-200/60 pt-2">
      <div className="col-span-2 flex flex-col gap-[2px]">
        <InspectorMicroLabel>Rich cell type</InspectorMicroLabel>
        <UiSelect
          size="sm"
          nested
          className="w-full bg-white text-slate-700"
          value={cellKind}
          onChange={(event) => {
            const nextKind = event.target.value as DesignerGridRichCellKind;
            onChange({
              cellKind: nextKind,
              cellFields: defaultRichCellFieldsForKind(nextKind),
            });
          }}
        >
          {DESIGNER_GRID_RICH_CELL_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </div>

      {renderFieldMappings(cellKind, column, node.id, onChange, lovOptions)}

      {richCellKindSupportsClick(cellKind) ? (
        <>
          <CellClickBehaviorFields
            nodeId={node.id}
            columnKey={column.key}
            behavior={column.cellClickBehavior}
            actionId={column.cellClickActionId}
            modalNodes={modalNodes}
            onBehaviorChange={(behavior) => onChange({ cellClickBehavior: behavior })}
            onActionIdChange={(actionId) => onChange({ cellClickActionId: actionId })}
          />
          <InspectorGridDisableRuleFields
            fieldKey={`${node.id}:${column.key}:cell-disabled-when`}
            rule={column.cellDisabledWhen}
            onChange={(cellDisabledWhen) => onChange({ cellDisabledWhen })}
          />
        </>
      ) : null}
    </InspectorFieldGroup>
  );
};
