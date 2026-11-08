import * as React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { DesignerNode, DesignerDocument } from '../../../domain/component-designer/types';
import {
  createDefaultGridRowAction,
  DESIGNER_GRID_ACTION_INTENT_OPTIONS,
  resolveDesignerGridActionIcon,
  type DesignerGridRowAction,
  type DesignerGridRowActionBehavior,
  type DesignerGridRowActionBehaviorKind,
} from '../../../domain/component-designer/designerGridActionColumns';
import { listDesignerModalNodes } from '../../../domain/component-designer/bindingGridDetailEngine';
import type { DesignerDataGridColumn } from '../../../domain/component-designer/designerDataGridColumns';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { ICON_ACTION_CANCEL_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { InspectorGridDisableRuleFields } from './InspectorGridDisableRuleFields';
import { InspectorLucideIconPickerField } from './InspectorLucideIconPickerField';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorFieldGroup, InspectorMicroLabel } from './inspectorFieldPrimitives';

type InspectorGridActionColumnFieldsProps = {
  node: DesignerNode;
  document: DesignerDocument;
  column: DesignerDataGridColumn;
  columnIndex: number;
  onChange: (patch: Partial<DesignerDataGridColumn>) => void;
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

const ActionBehaviorFields: React.FC<{
  nodeId: string;
  fieldKey: string;
  behavior: DesignerGridRowActionBehavior | undefined;
  modalNodes: DesignerNode[];
  onChange: (behavior: DesignerGridRowActionBehavior) => void;
}> = ({ nodeId, fieldKey, behavior, modalNodes, onChange }) => {
  const resolved = readBehavior(behavior);

  return (
    <InspectorFieldGroup columns={2} className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
      <div className="col-span-2 flex flex-col gap-[2px]">
        <InspectorMicroLabel>On click</InspectorMicroLabel>
        <UiSelect
          size="md"
          nested
          className="w-full bg-white text-slate-700"
          value={resolved.kind}
          onChange={(event) => {
            const nextKind = event.target.value as DesignerGridRowActionBehaviorKind;
            onChange({
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
          <div className="col-span-2 flex flex-col gap-[2px]">
            <InspectorMicroLabel>Modal</InspectorMicroLabel>
            <UiSelect
              size="md"
              nested
              className="w-full bg-white text-slate-700"
              value={resolved.modalNodeId ?? ''}
              onChange={(event) => onChange({
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
          <div className="flex flex-col gap-[2px]">
            <InspectorMicroLabel>Row key field</InspectorMicroLabel>
            <UiInput
              size="md"
              nested
              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
              value={resolved.primaryKeyField ?? 'id'}
              onChange={(event) => onChange({
                ...resolved,
                primaryKeyField: event.target.value,
              })}
              ariaLabel={`${fieldKey} primary key field`}
            />
          </div>
          <div className="flex flex-col gap-[2px]">
            <InspectorMicroLabel>Selection store path</InspectorMicroLabel>
            <UiInput
              size="md"
              nested
              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
              value={resolved.selectionStorePath ?? 'selection.id'}
              onChange={(event) => onChange({
                ...resolved,
                selectionStorePath: event.target.value,
              })}
              ariaLabel={`${fieldKey} selection store path`}
            />
          </div>
        </>
      ) : null}
    </InspectorFieldGroup>
  );
};

const ActionRowEditor: React.FC<{
  node: DesignerNode;
  modalNodes: DesignerNode[];
  action: DesignerGridRowAction;
  index: number;
  total: number;
  onChange: (patch: Partial<DesignerGridRowAction>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}> = ({ node, modalNodes, action, index, total, onChange, onMove, onRemove }) => {
  const Icon = resolveDesignerGridActionIcon(action.icon);

  return (
    <div className={`flex flex-col gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 shadow-sm`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 text-slate-600`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className={`${INSPECTOR_TEXT_XS} font-semibold text-slate-700`}>Action {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <AppButton
            type="button"
            size="icon-sm"
            className={ICON_ACTION_CANCEL_CLASS}
            aria-label={`Move action ${index + 1} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </AppButton>
          <AppButton
            type="button"
            size="icon-sm"
            className={ICON_ACTION_CANCEL_CLASS}
            aria-label={`Move action ${index + 1} down`}
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </AppButton>
          <AppButton
            type="button"
            size="icon-sm"
            className={ICON_ACTION_DELETE_CLASS}
            aria-label={`Remove action ${index + 1}`}
            disabled={total <= 1}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      </div>

      <InspectorFieldGroup columns={2}>
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Action ID</InspectorMicroLabel>
          <UiInput
            size="md"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            value={action.actionId}
            onChange={(event) => onChange({ actionId: event.target.value })}
            ariaLabel={`Action ${index + 1} id`}
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Tooltip</InspectorMicroLabel>
          <UiInput
            size="md"
            nested
            className="w-full bg-white text-slate-700"
            value={action.tooltip}
            onChange={(event) => onChange({ tooltip: event.target.value })}
            ariaLabel={`Action ${index + 1} tooltip`}
          />
        </div>
        <div className="col-span-2">
          <InspectorLucideIconPickerField
            label="Icon"
            value={action.icon}
            onChange={(icon) => onChange({ icon })}
            ariaLabel={`Action ${index + 1} icon`}
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Intent</InspectorMicroLabel>
          <UiSelect
            size="md"
            nested
            className="w-full bg-white text-slate-700"
            value={action.intent}
            onChange={(event) => onChange({
              intent: event.target.value as DesignerGridRowAction['intent'],
            })}
          >
            {DESIGNER_GRID_ACTION_INTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </UiSelect>
        </div>
      </InspectorFieldGroup>

      <ActionBehaviorFields
        nodeId={node.id}
        fieldKey={`${node.id}:action:${index}`}
        behavior={action.behavior}
        modalNodes={modalNodes}
        onChange={(behavior) => onChange({ behavior })}
      />

      <InspectorGridDisableRuleFields
        fieldKey={`${node.id}:action:${index}:disabled-when`}
        rule={action.disabledWhen}
        onChange={(disabledWhen) => onChange({ disabledWhen })}
      />
    </div>
  );
};

export const InspectorGridActionColumnFields: React.FC<InspectorGridActionColumnFieldsProps> = ({
  node,
  document,
  column,
  columnIndex,
  onChange,
}) => {
  const modalNodes = React.useMemo(
    () => listDesignerModalNodes(document),
    [document],
  );

  if (column.kind === 'action-group') {
    const actions = column.actions ?? [];

    const updateAction = (actionIndex: number, patch: Partial<DesignerGridRowAction>) => {
      onChange({
        actions: actions.map((action, index) => (
          index === actionIndex ? { ...action, ...patch } : action
        )),
      });
    };

    const moveAction = (actionIndex: number, direction: -1 | 1) => {
      const targetIndex = actionIndex + direction;
      if (targetIndex < 0 || targetIndex >= actions.length) {
        return;
      }

      const nextActions = [...actions];
      const [moved] = nextActions.splice(actionIndex, 1);
      if (!moved) {
        return;
      }
      nextActions.splice(targetIndex, 0, moved);
      onChange({ actions: nextActions });
    };

    return (
      <div className="flex flex-col gap-2 border-t border-slate-200/60 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-slate-500`}>
            Row actions
          </span>
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            onClick={() => onChange({
              actions: [
                ...actions,
                createDefaultGridRowAction(`action_${actions.length + 1}`),
              ],
            })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add action
          </AppButton>
        </div>

        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Visible icons</InspectorMicroLabel>
          <UiSelect
            size="md"
            nested
            className="w-full bg-white text-slate-700"
            value={String(column.maxVisibleActions ?? 3)}
            onChange={(event) => {
              const next = Number(event.target.value);
              onChange({ maxVisibleActions: Number.isFinite(next) ? next : 3 });
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={String(count)}>{count}</option>
            ))}
          </UiSelect>
        </div>

        {actions.map((action, actionIndex) => (
          <ActionRowEditor
            key={`${node.id}:column:${columnIndex}:action:${action.actionId}:${actionIndex}`}
            node={node}
            modalNodes={modalNodes}
            action={action}
            index={actionIndex}
            total={actions.length}
            onChange={(patch) => updateAction(actionIndex, patch)}
            onMove={(direction) => moveAction(actionIndex, direction)}
            onRemove={() => onChange({
              actions: actions.filter((_, index) => index !== actionIndex),
            })}
          />
        ))}
      </div>
    );
  }

  if (column.kind !== 'action') {
    return null;
  }

  const actionDefinition = createDefaultGridRowAction(column.actionId ?? `action_${columnIndex + 1}`, {
    icon: column.actionIcon ?? 'Settings2',
    intent: column.actionIntent ?? 'utility',
    tooltip: column.actionTooltip ?? column.label ?? 'Action',
    label: column.label,
    behavior: column.actionBehavior,
  });

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/60 pt-2">
      <InspectorFieldGroup columns={2}>
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Action ID</InspectorMicroLabel>
          <UiInput
            size="md"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            value={column.actionId ?? ''}
            onChange={(event) => onChange({
              actionId: event.target.value,
              key: event.target.value.trim().length > 0
                ? `__action_${event.target.value.trim()}`
                : column.key,
            })}
            ariaLabel={`Column ${columnIndex + 1} action id`}
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Display</InspectorMicroLabel>
          <UiSelect
            size="md"
            nested
            className="w-full bg-white text-slate-700"
            value={column.actionDisplay === 'icon' ? 'icon' : 'button'}
            onChange={(event) => onChange({
              actionDisplay: event.target.value === 'icon' ? 'icon' : 'button',
            })}
          >
            <option value="button">Text button</option>
            <option value="icon">Icon button</option>
          </UiSelect>
        </div>
        {column.actionDisplay === 'icon' ? (
          <>
            <div className="col-span-2">
              <InspectorLucideIconPickerField
                label="Icon"
                value={column.actionIcon ?? 'Settings2'}
                onChange={(actionIcon) => onChange({ actionIcon })}
                ariaLabel={`Column ${columnIndex + 1} icon`}
              />
            </div>
            <div className="flex flex-col gap-[2px]">
              <InspectorMicroLabel>Intent</InspectorMicroLabel>
              <UiSelect
                size="md"
                nested
                className="w-full bg-white text-slate-700"
                value={column.actionIntent ?? 'utility'}
                onChange={(event) => onChange({
                  actionIntent: event.target.value as DesignerGridRowAction['intent'],
                })}
              >
                {DESIGNER_GRID_ACTION_INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </UiSelect>
            </div>
            <div className="col-span-2 flex flex-col gap-[2px]">
              <InspectorMicroLabel>Tooltip</InspectorMicroLabel>
              <UiInput
                size="md"
                nested
                className="w-full bg-white text-slate-700"
                value={column.actionTooltip ?? ''}
                onChange={(event) => onChange({ actionTooltip: event.target.value })}
                ariaLabel={`Column ${columnIndex + 1} tooltip`}
              />
            </div>
          </>
        ) : null}
      </InspectorFieldGroup>

      <ActionBehaviorFields
        nodeId={node.id}
        fieldKey={`${node.id}:column:${columnIndex}:action-behavior`}
        behavior={column.actionBehavior}
        modalNodes={modalNodes}
        onChange={(behavior) => onChange({ actionBehavior: behavior })}
      />

      <InspectorGridDisableRuleFields
        fieldKey={`${node.id}:column:${columnIndex}:action-disabled-when`}
        rule={column.actionDisabledWhen}
        onChange={(actionDisabledWhen) => onChange({ actionDisabledWhen })}
      />

      <div className={`flex items-center gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-2 py-1.5`}>
        {(() => {
          const Icon = resolveDesignerGridActionIcon(actionDefinition.icon);
          return <Icon className="h-4 w-4 text-slate-600" aria-hidden="true" />;
        })()}
        <span className={`${INSPECTOR_TEXT_XS} text-slate-600`}>
          Preview uses semantic colors from action intent.
        </span>
      </div>
    </div>
  );
};
