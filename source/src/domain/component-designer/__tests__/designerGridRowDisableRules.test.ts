import { describe, expect, it } from 'vitest';
import {
  USERS_ACTION_GROUP_COLUMN_PRESET,
  USERS_LOGIN_AS_ACTION_PRESET,
} from '../designerGridActionColumns';
import {
  applyUsersBusinessRulesToColumns,
  compileDesignerRowConditionExpression,
  isDesignerGridRowDisabled,
  parseDesignerGridRowDisableRule,
  rowHasRole,
} from '../designerGridRowDisableRules';
import {
  USERS_PROFILE_LINK_COLUMN_PRESET,
  USERS_ROLES_CHIPS_COLUMN_PRESET,
} from '../designerGridRichCellColumns';

describe('designerGridRowDisableRules', () => {
  it('parses disable rule presets', () => {
    expect(parseDesignerGridRowDisableRule({ preset: 'users-restricted' })).toEqual({
      preset: 'users-restricted',
    });
    expect(parseDesignerGridRowDisableRule({ preset: 'expression', expression: "row.is_builtin" })).toEqual({
      preset: 'expression',
      expression: 'row.is_builtin',
    });
    expect(parseDesignerGridRowDisableRule({ preset: 'invalid' })).toBeUndefined();
  });

  it('evaluates users-restricted and users-admin presets', () => {
    const builtinAdminRow = { is_builtin: true, roles: ['USER'] };
    const adminRow = { is_builtin: false, roles: ['ADMIN'] };
    const regularRow = { is_builtin: false, roles: ['USER'] };

    expect(isDesignerGridRowDisabled(builtinAdminRow, { preset: 'users-restricted' })).toBe(true);
    expect(isDesignerGridRowDisabled(adminRow, { preset: 'users-restricted' })).toBe(true);
    expect(isDesignerGridRowDisabled(regularRow, { preset: 'users-restricted' })).toBe(false);

    expect(isDesignerGridRowDisabled(adminRow, { preset: 'users-admin' })).toBe(true);
    expect(isDesignerGridRowDisabled(regularRow, { preset: 'users-admin' })).toBe(false);
  });

  it('evaluates users-login-as preset with current user from store', () => {
    const row = { id: 7, roles: ['USER'] };
    const adminRow = { id: 8, roles: ['ADMIN'] };

    expect(isDesignerGridRowDisabled(row, { preset: 'users-login-as' }, { user: { id: 7 } })).toBe(true);
    expect(isDesignerGridRowDisabled(row, { preset: 'users-login-as' }, { user: { id: 3 } })).toBe(false);
    expect(isDesignerGridRowDisabled(adminRow, { preset: 'users-login-as' }, { user: { id: 3 } })).toBe(true);
  });

  it('evaluates custom row expressions', () => {
    const row = { is_builtin: false, roles: ['MANAGER'] };
    expect(isDesignerGridRowDisabled(row, {
      preset: 'expression',
      expression: "row.roles.includes('MANAGER')",
    })).toBe(true);
  });

  it('compiles row expressions to item paths', () => {
    expect(compileDesignerRowConditionExpression("row.is_builtin || store.user.id === item.id"))
      .toContain('item?.is_builtin');
  });

  it('detects row roles case-insensitively', () => {
    expect(rowHasRole({ roles: ['ADMIN'] }, 'ADMIN')).toBe(true);
  });

  it('applies Users business rules to action and rich columns', () => {
    const columns = applyUsersBusinessRulesToColumns([
      USERS_LOGIN_AS_ACTION_PRESET,
      USERS_ACTION_GROUP_COLUMN_PRESET,
      USERS_PROFILE_LINK_COLUMN_PRESET,
      USERS_ROLES_CHIPS_COLUMN_PRESET,
    ]);

    const loginAs = columns.find((column) => column.actionId === 'login-as');
    expect(loginAs?.actionDisabledWhen?.preset).toBe('users-login-as');
    expect(loginAs?.actionBehavior?.kind).toBe('open-modal');

    const actionGroup = columns.find((column) => column.kind === 'action-group');
    expect(actionGroup?.actions?.find((action) => action.actionId === 'delete')?.disabledWhen?.preset)
      .toBe('users-restricted');
    expect(actionGroup?.actions?.find((action) => action.actionId === 'function-access')?.disabledWhen?.preset)
      .toBe('users-admin');

    const profile = columns.find((column) => column.key === 'full_name');
    expect(profile?.cellDisabledWhen?.preset).toBe('users-restricted');
    expect(profile?.cellClickBehavior?.selectionStorePath).toBe('selection.id');
  });
});
