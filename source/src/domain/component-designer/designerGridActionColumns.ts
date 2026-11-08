import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toLucidePascalCase } from '../../shared/lib/lucideIconRegistry';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  gridActionsColumnWidth,
  resolveGridActionSlotCount,
} from '../../shared/lib/gridRowActions';
import type { DesignerDataGridColumn } from './designerDataGridColumns';
import {
  parseDesignerGridRowDisableRule,
  type DesignerGridRowDisableRule,
} from './designerGridRowDisableRules';

export const GRID_DETAIL_ACTION_ID = 'details';

export type { DesignerGridRowDisableRule, DesignerGridRowDisablePreset } from './designerGridRowDisableRules';

export type DesignerGridActionIntent =
  | 'view'
  | 'edit'
  | 'delete'
  | 'access'
  | 'utility'
  | 'warning';

export type DesignerGridActionDisplay = 'button' | 'icon';

export type DesignerGridRowActionBehaviorKind =
  | 'none'
  | 'detail-flow'
  | 'open-modal'
  | 'navigate'
  | 'callMutation'
  | 'pick-file-create'
  | 'hwy-family-household'
  | 'hwy-image-fix-editor';

export type DesignerGridRowActionBehavior = {
  kind: DesignerGridRowActionBehaviorKind;
  modalNodeId?: string;
  primaryKeyField?: string;
  selectionStorePath?: string;
  navigateTarget?: string;
  navigateReplace?: boolean;
  dataSourceRef?: string;
  mutationOperation?: 'create' | 'update' | 'delete';
  /** Static JSON fields merged into the mutation body. */
  mutationBody?: Record<string, unknown>;
  /** Row fields copied into the mutation body (primary key included by default). */
  mutationBodyRowFields?: string[];
  /** Refresh the grid list data source after a successful mutation. */
  refreshList?: boolean;
  /**
   * Store path for the parent record id when creating an attachment
   * (`pick-file-create`), e.g. `routeParams.id`.
   */
  contentIdStorePath?: string;
  /** Native file input `accept` for `pick-file-create`. */
  accept?: string;
  /** Allow selecting multiple files in `pick-file-create` (default true). */
  multiple?: boolean;
  /** Skip non-image files during `pick-file-create`. */
  imageOnly?: boolean;
  /** Skip image files during `pick-file-create`. */
  nonImageOnly?: boolean;
};

export type DesignerGridRowAction = {
  actionId: string;
  icon: string;
  intent: DesignerGridActionIntent;
  tooltip: string;
  label?: string;
  /** Optional row field rendered as a compact count badge on the action. */
  badgeField?: string;
  behavior?: DesignerGridRowActionBehavior;
  disabledWhen?: DesignerGridRowDisableRule;
};

export const DESIGNER_GRID_ACTION_BUTTON_CLASS =
  'relative h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';

export const GRID_ACTION_INTENT_CLASS: Record<DesignerGridActionIntent, string> = {
  view: 'text-slate-600 hover:text-slate-700 hover:bg-slate-50',
  edit: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
  delete: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50',
  access: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
  utility: 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50',
  warning: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
};

export const DESIGNER_GRID_ACTION_INTENT_OPTIONS: ReadonlyArray<{
  value: DesignerGridActionIntent;
  label: string;
}> = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'access', label: 'Access' },
  { value: 'utility', label: 'Utility' },
  { value: 'warning', label: 'Warning' },
];

export const DESIGNER_GRID_ACTION_ICON_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: 'Eye', label: 'View (Eye)' },
  { value: 'Pencil', label: 'Edit (Pencil)' },
  { value: 'Tags', label: 'Attributes (Tags)' },
  { value: 'KeyRound', label: 'Access (Key)' },
  { value: 'UserLock', label: 'Password (UserLock)' },
  { value: 'RotateCcwKey', label: 'Reset (RotateCcwKey)' },
  { value: 'Trash2', label: 'Delete (Trash2)' },
  { value: 'LogIn', label: 'Login As (LogIn)' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Settings2', label: 'Settings' },
  { value: 'MoreHorizontal', label: 'More' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseGridActionIntent = (value: unknown): DesignerGridActionIntent | undefined => {
  if (
    value === 'view'
    || value === 'edit'
    || value === 'delete'
    || value === 'access'
    || value === 'utility'
    || value === 'warning'
  ) {
    return value;
  }
  return undefined;
};

export const parseDesignerGridRowActionBehavior = (value: unknown): DesignerGridRowActionBehavior | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const kind = value.kind;
  if (
    kind !== 'none'
    && kind !== 'detail-flow'
    && kind !== 'open-modal'
    && kind !== 'navigate'
    && kind !== 'callMutation'
    && kind !== 'pick-file-create'
    && kind !== 'hwy-family-household'
    && kind !== 'hwy-image-fix-editor'
  ) {
    return undefined;
  }

  const modalNodeId = typeof value.modalNodeId === 'string' ? value.modalNodeId.trim() : '';
  const primaryKeyField = typeof value.primaryKeyField === 'string' ? value.primaryKeyField.trim() : '';
  const selectionStorePath = typeof value.selectionStorePath === 'string' ? value.selectionStorePath.trim() : '';
  const navigateTarget = typeof value.navigateTarget === 'string' ? value.navigateTarget.trim() : '';
  const dataSourceRef = typeof value.dataSourceRef === 'string' ? value.dataSourceRef.trim() : '';
  const mutationOperation = value.mutationOperation === 'create'
    || value.mutationOperation === 'update'
    || value.mutationOperation === 'delete'
    ? value.mutationOperation
    : undefined;
  const mutationBody = isRecord(value.mutationBody) ? value.mutationBody : undefined;
  const mutationBodyRowFields = Array.isArray(value.mutationBodyRowFields)
    ? value.mutationBodyRowFields
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
    : undefined;
  const contentIdStorePath = typeof value.contentIdStorePath === 'string'
    ? value.contentIdStorePath.trim()
    : '';
  const accept = typeof value.accept === 'string' ? value.accept.trim() : '';

  return {
    kind,
    ...(modalNodeId ? { modalNodeId } : {}),
    ...(primaryKeyField ? { primaryKeyField } : {}),
    ...(selectionStorePath ? { selectionStorePath } : {}),
    ...(navigateTarget ? { navigateTarget } : {}),
    ...(typeof value.navigateReplace === 'boolean' ? { navigateReplace: value.navigateReplace } : {}),
    ...(dataSourceRef ? { dataSourceRef } : {}),
    ...(mutationOperation ? { mutationOperation } : {}),
    ...(mutationBody ? { mutationBody } : {}),
    ...(mutationBodyRowFields && mutationBodyRowFields.length > 0 ? { mutationBodyRowFields } : {}),
    ...(value.refreshList === true ? { refreshList: true } : {}),
    ...(contentIdStorePath ? { contentIdStorePath } : {}),
    ...(accept ? { accept } : {}),
    ...(typeof value.multiple === 'boolean' ? { multiple: value.multiple } : {}),
  };
};

export const parseDesignerGridRowAction = (value: unknown): DesignerGridRowAction | null => {
  if (!isRecord(value)) {
    return null;
  }

  const actionId = typeof value.actionId === 'string' ? value.actionId.trim() : '';
  const icon = typeof value.icon === 'string' ? value.icon.trim() : '';
  const tooltip = typeof value.tooltip === 'string' ? value.tooltip.trim() : '';
  const intent = parseGridActionIntent(value.intent) ?? 'utility';
  if (!actionId || !icon) {
    return null;
  }

  const label = typeof value.label === 'string' ? value.label.trim() : undefined;
  const badgeField = typeof value.badgeField === 'string' ? value.badgeField.trim() : undefined;
  const behavior = parseDesignerGridRowActionBehavior(value.behavior);
  const disabledWhen = parseDesignerGridRowDisableRule(value.disabledWhen);

  return {
    actionId,
    icon,
    intent,
    tooltip: tooltip || label || actionId,
    ...(label ? { label } : {}),
    ...(badgeField ? { badgeField } : {}),
    ...(behavior ? { behavior } : {}),
    ...(disabledWhen ? { disabledWhen } : {}),
  };
};

export const parseDesignerGridRowActions = (value: unknown): DesignerGridRowAction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseDesignerGridRowAction(entry))
    .filter((entry): entry is DesignerGridRowAction => entry !== null);
};

export const resolveDesignerGridActionIcon = (iconName: string): LucideIcon => {
  const trimmed = iconName.trim();
  if (!trimmed) {
    return LucideIcons.Settings;
  }

  const pascal = toLucidePascalCase(trimmed);
  const icon = (LucideIcons as Record<string, LucideIcon | undefined>)[pascal]
    ?? (LucideIcons as Record<string, LucideIcon | undefined>)[trimmed];
  return icon ?? LucideIcons.Settings;
};

export const isActionGroupColumn = (column: DesignerDataGridColumn): boolean =>
  column.kind === 'action-group';

export const isIconActionColumn = (column: DesignerDataGridColumn): boolean =>
  column.kind === 'action' && column.actionDisplay === 'icon';

export const createDefaultGridRowAction = (
  actionId: string,
  overrides: Partial<DesignerGridRowAction> = {},
): DesignerGridRowAction => ({
  actionId,
  icon: 'Settings2',
  intent: 'utility',
  tooltip: actionId,
  ...overrides,
});

export const createIconActionColumn = (
  actionId: string,
  options: {
    label?: string;
    icon?: string;
    intent?: DesignerGridActionIntent;
    tooltip?: string;
    width?: string;
    behavior?: DesignerGridRowActionBehavior;
    disabledWhen?: DesignerGridRowDisableRule;
    layoutHideable?: boolean;
  } = {},
): DesignerDataGridColumn => ({
  key: `__action_${actionId}`,
  label: options.label?.trim() || '',
  kind: 'action',
  actionId,
  actionDisplay: 'icon',
  actionIcon: options.icon ?? 'Settings2',
  actionIntent: options.intent ?? 'utility',
  actionTooltip: options.tooltip ?? options.label ?? actionId,
  width: options.width ?? '48px',
  layoutHideable: options.layoutHideable ?? true,
  layoutResizable: false,
  layoutReorderable: false,
  cardRole: 'actions',
  ...(options.behavior ? { actionBehavior: options.behavior } : {}),
  ...(options.disabledWhen ? { actionDisabledWhen: options.disabledWhen } : {}),
});

export const createActionGroupColumn = (
  actions: DesignerGridRowAction[],
  options: {
    key?: string;
    label?: string;
    width?: string;
    layoutHideable?: boolean;
    layoutPinned?: 'left' | 'right';
    maxVisibleActions?: number;
  } = {},
): DesignerDataGridColumn => {
  const maxVisibleActions = options.maxVisibleActions ?? DEFAULT_GRID_MAX_VISIBLE_ACTIONS;
  const slotCount = resolveGridActionSlotCount(actions.length, maxVisibleActions);
  return {
    key: options.key ?? 'actions',
    label: options.label ?? '',
    kind: 'action-group',
    width: options.width ?? `${gridActionsColumnWidth(slotCount)}px`,
    layoutHideable: options.layoutHideable ?? false,
    layoutResizable: false,
    layoutReorderable: false,
    layoutPinned: options.layoutPinned ?? 'right',
    cardRole: 'actions',
    maxVisibleActions,
    actions,
  };
};

export const USERS_ROW_ACTIONS_PRESET: DesignerGridRowAction[] = [
  {
    actionId: 'edit-attributes',
    icon: 'Tags',
    intent: 'edit',
    tooltip: 'Edit Attributes',
  },
  {
    actionId: 'function-access',
    icon: 'KeyRound',
    intent: 'access',
    tooltip: 'Server Function Access',
  },
  {
    actionId: 'change-password',
    icon: 'UserLock',
    intent: 'utility',
    tooltip: 'Change Password',
  },
  {
    actionId: 'reset-password',
    icon: 'RotateCcwKey',
    intent: 'warning',
    tooltip: 'Reset Password',
  },
  {
    actionId: 'delete',
    icon: 'Trash2',
    intent: 'delete',
    tooltip: 'Delete',
  },
];

export const USERS_LOGIN_AS_ACTION_PRESET = createIconActionColumn('login-as', {
  label: 'Login As',
  icon: 'LogIn',
  intent: 'utility',
  tooltip: 'Login As',
  width: '116px',
  layoutHideable: false,
});

export const USERS_ACTION_GROUP_COLUMN_PRESET = createActionGroupColumn(USERS_ROW_ACTIONS_PRESET, {
  key: 'actions',
  maxVisibleActions: 5,
  layoutHideable: false,
});

export const collectGridRowActionsFromColumns = (
  columns: readonly DesignerDataGridColumn[],
): DesignerGridRowAction[] => {
  const actions: DesignerGridRowAction[] = [];
  const seen = new Set<string>();

  for (const column of columns) {
    if (isActionGroupColumn(column)) {
      for (const action of column.actions ?? []) {
        if (!seen.has(action.actionId)) {
          seen.add(action.actionId);
          actions.push(action);
        }
      }
      continue;
    }

    if (column.kind === 'action') {
      const actionId = column.actionId?.trim()
        || (column.key.startsWith('__action_') ? column.key.slice('__action_'.length) : GRID_DETAIL_ACTION_ID);
      if (seen.has(actionId)) {
        continue;
      }
      seen.add(actionId);

      if (column.actionDisplay === 'icon') {
        actions.push({
          actionId,
          icon: column.actionIcon ?? 'Settings2',
          intent: column.actionIntent ?? 'utility',
          tooltip: column.actionTooltip ?? column.label ?? actionId,
          label: column.label,
          ...(column.actionBehavior ? { behavior: column.actionBehavior } : {}),
        });
      } else {
        actions.push({
          actionId,
          icon: 'Eye',
          intent: 'view',
          tooltip: column.label || 'Details',
          label: column.label,
          ...(column.actionBehavior ? { behavior: column.actionBehavior } : {}),
        });
      }
    }
  }

  return actions;
};

export const findGridRowActionDefinition = (
  columns: readonly DesignerDataGridColumn[],
  actionId: string,
): DesignerGridRowAction | undefined => {
  const normalized = actionId.trim();
  if (!normalized) {
    return undefined;
  }

  return collectGridRowActionsFromColumns(columns).find((action) => action.actionId === normalized);
};

export const resolveInspectorColumnType = (column: DesignerDataGridColumn): string => {
  if (isActionGroupColumn(column)) {
    return 'action-group';
  }
  if (isIconActionColumn(column)) {
    return 'icon-action';
  }
  if (column.kind === 'action') {
    return 'action';
  }
  return 'field';
};
