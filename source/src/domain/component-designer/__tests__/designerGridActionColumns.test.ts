import { describe, expect, it } from 'vitest';
import {
  collectGridRowActionsFromColumns,
  createActionGroupColumn,
  createIconActionColumn,
  parseDesignerGridRowAction,
  parseDesignerGridRowActions,
  USERS_ACTION_GROUP_COLUMN_PRESET,
} from '../designerGridActionColumns';
import {
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';

describe('designerGridActionColumns', () => {
  it('parses icon action columns from JSON', () => {
    const columns = parseDesignerDataGridColumns(serializeDesignerDataGridColumns([
      createIconActionColumn('login-as', {
        icon: 'LogIn',
        intent: 'utility',
        tooltip: 'Login As',
        layoutHideable: false,
      }),
    ]));

    expect(columns).toHaveLength(1);
    expect(columns[0]?.kind).toBe('action');
    expect(columns[0]?.actionDisplay).toBe('icon');
    expect(columns[0]?.actionIcon).toBe('LogIn');
    expect(columns[0]?.actionIntent).toBe('utility');
  });

  it('defaults action group columns to a pinned trailing edge', () => {
    const column = createActionGroupColumn([
      { actionId: 'edit', icon: 'Pencil', intent: 'edit', tooltip: 'Edit' },
    ]);
    expect(column.layoutPinned).toBe('right');
  });

  it('parses action group columns and nested actions', () => {
    const columns = parseDesignerDataGridColumns(serializeDesignerDataGridColumns([
      USERS_ACTION_GROUP_COLUMN_PRESET,
    ]));

    expect(columns[0]?.kind).toBe('action-group');
    expect(columns[0]?.actions).toHaveLength(5);
    expect(columns[0]?.actions?.[0]?.actionId).toBe('edit-attributes');
    expect(columns[0]?.actions?.[4]?.icon).toBe('Trash2');
  });

  it('collects unique row actions from mixed columns', () => {
    const actions = collectGridRowActionsFromColumns([
      createIconActionColumn('login-as', { icon: 'LogIn', tooltip: 'Login As' }),
      createActionGroupColumn([
        { actionId: 'delete', icon: 'Trash2', intent: 'delete', tooltip: 'Delete' },
        { actionId: 'edit-attributes', icon: 'Tags', intent: 'edit', tooltip: 'Edit Attributes' },
      ]),
    ]);

    expect(actions.map((action) => action.actionId)).toEqual([
      'login-as',
      'delete',
      'edit-attributes',
    ]);
  });

  it('sanitizes invalid nested actions', () => {
    const parsed = parseDesignerGridRowActions([
      { actionId: 'valid', icon: 'Eye', intent: 'view', tooltip: 'View' },
      { actionId: '', icon: 'Trash2' },
      null,
    ]);

    expect(parsed).toHaveLength(1);
    expect(parseDesignerGridRowAction(parsed[0])).not.toBeNull();
  });
});
