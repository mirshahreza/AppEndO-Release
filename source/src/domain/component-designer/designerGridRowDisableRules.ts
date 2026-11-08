import type { DesignerDataGridColumn } from './designerDataGridColumns';
import type { DesignerGridRowAction, DesignerGridRowActionBehavior } from './designerGridActionColumns';
import {
  compileDesignerConditionExpression,
  isSafeDesignerRuntimeExpression,
} from './visibilityConditionEngine';

export type DesignerGridRowDisablePreset =
  | 'none'
  | 'users-restricted'
  | 'users-admin'
  | 'users-login-as'
  | 'current-user-row'
  | 'builtin-field'
  | 'has-role'
  | 'expression';

export type DesignerGridRowDisableRule = {
  preset: DesignerGridRowDisablePreset;
  field?: string;
  /** Row field compared to `store.user.id` for `current-user-row` (default: `id`). */
  matchField?: string;
  role?: string;
  expression?: string;
};

export const DESIGNER_GRID_ROW_DISABLE_PRESET_OPTIONS: ReadonlyArray<{
  value: DesignerGridRowDisablePreset;
  label: string;
}> = [
  { value: 'none', label: 'Never disabled' },
  { value: 'users-restricted', label: 'Users: built-in or ADMIN' },
  { value: 'users-admin', label: 'Users: ADMIN role' },
  { value: 'users-login-as', label: 'Users: login-as guard' },
  { value: 'current-user-row', label: 'Current user owns this row' },
  { value: 'builtin-field', label: 'Row field is true' },
  { value: 'has-role', label: 'Row has role' },
  { value: 'expression', label: 'Custom expression' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseDesignerGridRowDisableRule = (value: unknown): DesignerGridRowDisableRule | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const preset = value.preset;
  if (
    preset !== 'none'
    && preset !== 'users-restricted'
    && preset !== 'users-admin'
    && preset !== 'users-login-as'
    && preset !== 'current-user-row'
    && preset !== 'builtin-field'
    && preset !== 'has-role'
    && preset !== 'expression'
  ) {
    return undefined;
  }

  const field = readTrimmedString(value.field);
  const matchField = readTrimmedString(value.matchField);
  const role = readTrimmedString(value.role);
  const expression = readTrimmedString(value.expression);

  return {
    preset,
    ...(field ? { field } : {}),
    ...(matchField ? { matchField } : {}),
    ...(role ? { role } : {}),
    ...(expression ? { expression } : {}),
  };
};

const readRowBoolean = (row: Record<string, unknown>, field: string): boolean => {
  const value = row[field];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return Boolean(value);
};

const readRowRoles = (row: Record<string, unknown>, field = 'roles'): string[] => {
  const value = row[field];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim().toUpperCase());
};

export const rowHasRole = (row: Record<string, unknown>, role: string, rolesField = 'roles'): boolean => {
  const normalizedRole = role.trim().toUpperCase();
  if (!normalizedRole) {
    return false;
  }
  return readRowRoles(row, rolesField).includes(normalizedRole);
};

const isSameUserRow = (
  row: Record<string, unknown>,
  designerStore: Record<string, unknown> | null | undefined,
  matchField = 'id',
): boolean => {
  const field = matchField.trim() || 'id';
  const rowValue = row[field];
  const rowId = typeof rowValue === 'number' || typeof rowValue === 'string'
    ? Number(rowValue)
    : Number.NaN;
  const user = designerStore?.user;
  const currentUserId = isRecord(user) ? Number(user.id) : Number.NaN;
  return Number.isFinite(rowId) && Number.isFinite(currentUserId) && rowId === currentUserId;
};

/** Builds the expression that `current-user-row` evaluates (for docs/tests/codegen parity). */
export const buildCurrentUserRowDisableExpression = (matchField = 'id'): string => {
  const field = matchField.trim() || 'id';
  return `store.user.id === row.${field}`;
};

export const compileDesignerRowConditionExpression = (condition: string): string => {
  const formatPathChain = (root: string, path: string): string => {
    const chain = path
      .split('.')
      .filter(Boolean)
      .map((segment) => {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
          return `?.${segment}`;
        }
        return `?.[${JSON.stringify(segment)}]`;
      })
      .join('');

    return `(${root}${chain})`;
  };

  let compiled = condition.trim();
  if (compiled.length === 0) {
    return 'false';
  }

  compiled = compiled.replace(/\brow\.([A-Za-z0-9_.-]+)/g, (_, path: string) =>
    formatPathChain('item', path),
  );

  compiled = compileDesignerConditionExpression(compiled);
  return compiled;
};

const evaluateDesignerRowExpression = (
  row: Record<string, unknown>,
  expression: string,
  designerStore: Record<string, unknown> | null | undefined,
): boolean => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return false;
  }
  if (!isSafeDesignerRuntimeExpression(trimmed)) {
    return false;
  }

  try {
    const compiled = compileDesignerRowConditionExpression(trimmed);
    const evaluator = new Function(
      'designerStore',
      'item',
      `return Boolean(${compiled});`,
    ) as (
      designerStore: Record<string, unknown> | null | undefined,
      item: Record<string, unknown>,
    ) => boolean;
    return Boolean(evaluator(designerStore ?? {}, row));
  } catch {
    return false;
  }
};

export const isDesignerGridRowDisabled = (
  row: Record<string, unknown>,
  rule: DesignerGridRowDisableRule | undefined,
  designerStore: Record<string, unknown> | null | undefined = {},
): boolean => {
  if (!rule || rule.preset === 'none') {
    return false;
  }

  switch (rule.preset) {
    case 'users-restricted':
      return readRowBoolean(row, 'is_builtin') || rowHasRole(row, 'ADMIN');
    case 'users-admin':
      return rowHasRole(row, 'ADMIN');
    case 'users-login-as':
      return rowHasRole(row, 'ADMIN') || isSameUserRow(row, designerStore);
    case 'current-user-row':
      return isSameUserRow(row, designerStore, rule.matchField ?? rule.field ?? 'id');
    case 'builtin-field':
      return readRowBoolean(row, rule.field ?? 'is_builtin');
    case 'has-role':
      return rowHasRole(row, rule.role ?? 'ADMIN');
    case 'expression':
      return evaluateDesignerRowExpression(row, rule.expression ?? '', designerStore);
    default:
      return false;
  }
};

export const USERS_ACTION_DISABLE_RULES: Record<string, DesignerGridRowDisableRule> = {
  'edit-attributes': { preset: 'users-restricted' },
  'function-access': { preset: 'users-admin' },
  'change-password': { preset: 'users-restricted' },
  'reset-password': { preset: 'users-restricted' },
  delete: { preset: 'users-restricted' },
  'login-as': { preset: 'users-login-as' },
};

export const USERS_CELL_DISABLE_RULE: DesignerGridRowDisableRule = { preset: 'users-restricted' };

export const USERS_ROW_SELECTION_BEHAVIOR: DesignerGridRowActionBehavior = {
  kind: 'open-modal',
  primaryKeyField: 'id',
  selectionStorePath: 'selection.id',
};

const USERS_MODAL_ACTION_IDS = new Set([
  'edit-attributes',
  'function-access',
  'change-password',
  'reset-password',
  'delete',
  'login-as',
  'edit-profile',
  'edit-roles',
  'toggle-locked',
]);

const withUsersModalBehavior = <T extends { behavior?: DesignerGridRowActionBehavior }>(
  entry: T,
): T => {
  if (entry.behavior?.kind && entry.behavior.kind !== 'none') {
    return entry;
  }
  return {
    ...entry,
    behavior: USERS_ROW_SELECTION_BEHAVIOR,
  };
};

export const applyUsersBusinessRulesToColumns = (
  columns: readonly DesignerDataGridColumn[],
): DesignerDataGridColumn[] =>
  columns.map((column) => {
    if (column.kind === 'action-group' && column.actions?.length) {
      return {
        ...column,
        actions: column.actions.map((action) => withUsersModalBehavior({
          ...action,
          disabledWhen: USERS_ACTION_DISABLE_RULES[action.actionId] ?? action.disabledWhen,
        })),
      };
    }

    if (column.kind === 'action' && column.actionId) {
      const rule = USERS_ACTION_DISABLE_RULES[column.actionId];
      const withRule = rule
        ? { ...column, actionDisabledWhen: rule }
        : column;
      if (!USERS_MODAL_ACTION_IDS.has(column.actionId)) {
        return withRule;
      }
      return {
        ...withRule,
        actionBehavior: withRule.actionBehavior?.kind && withRule.actionBehavior.kind !== 'none'
          ? withRule.actionBehavior
          : USERS_ROW_SELECTION_BEHAVIOR,
      };
    }

    if (
      column.cellKind === 'link'
      || column.cellKind === 'chips'
      || column.cellKind === 'lock-status'
    ) {
      const actionId = column.cellClickActionId?.trim();
      return {
        ...column,
        cellDisabledWhen: USERS_CELL_DISABLE_RULE,
        ...(actionId && USERS_MODAL_ACTION_IDS.has(actionId) && (!column.cellClickBehavior || column.cellClickBehavior.kind === 'none')
          ? { cellClickBehavior: USERS_ROW_SELECTION_BEHAVIOR }
          : {}),
      };
    }

    return column;
  });

export const applyUsersBusinessRulesToActions = (
  actions: readonly DesignerGridRowAction[],
): DesignerGridRowAction[] =>
  actions.map((action) => ({
    ...action,
    disabledWhen: USERS_ACTION_DISABLE_RULES[action.actionId] ?? action.disabledWhen,
  }));

export const DESIGNER_GRID_COLUMN_LAYOUT_STORE_PATH = 'gridColumnLayouts';
