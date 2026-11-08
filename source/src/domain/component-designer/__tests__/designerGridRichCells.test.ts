import { describe, expect, it } from 'vitest';
import {
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';
import {
  defaultRichCellFieldsForKind,
  isRichCellKind,
  readDesignerGridChipValues,
  readDesignerGridDisplayLabel,
  readDesignerGridRowBoolean,
  readDesignerGridRowString,
  resolveRichCellFilterValue,
  resolveRichCellSortValue,
  USERS_ACCOUNT_COLUMN_PRESET,
  USERS_AVATAR_COLUMN_PRESET,
  USERS_RICH_COLUMNS_PRESET,
  designerGridColumnAllowsCellClickInvoke,
} from '../designerGridRichCellColumns';
import { executeDesignerGridCellClick } from '../bindingGridRowActionRuntime';
import { createInitialDesignerState, designerReducer } from '../state';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import { APP_TABLE_GRID_PALETTE_ITEM_ID } from '../designerDataGridColumns';

describe('designerGridRichCellColumns', () => {
  it('parses rich cell kinds and field mappings from JSON', () => {
    const columns = parseDesignerDataGridColumns(JSON.stringify([
      {
        key: 'email',
        label: 'Account',
        cellKind: 'account',
        cellFields: {
          primaryField: 'email',
          secondaryField: 'username',
          badgeField: 'is_builtin',
        },
        cellClickBehavior: {
          kind: 'none',
        },
      },
      {
        key: 'roles',
        label: 'Roles',
        cellKind: 'chips',
        cellFields: { valuesField: 'roles' },
        cellClickActionId: 'edit-roles',
      },
    ]));

    expect(columns[0]?.cellKind).toBe('account');

    const registered = parseDesignerDataGridColumns(JSON.stringify([{
      key: 'nakhebinJoinTasjilStateCodeTitle',
      label: 'Registered',
      cellKind: 'hwy-registered-icon',
      cellFields: {
        primaryField: 'nakhebinJoinTasjilStateCodeTitle',
        secondaryField: 'nakhebinJoinTasjilStateCode',
      },
    }]));
    expect(registered[0]?.cellKind).toBe('hwy-registered-icon');

    const memberFace = parseDesignerDataGridColumns(JSON.stringify([{
      key: 'displayFullName',
      label: 'Member',
      cellKind: 'hwy-member-face',
      cellFields: {
        imageUrlField: 'avatarUrl',
        captionField: 'username',
        primaryField: 'displayFullName',
        secondaryField: 'birthYear',
        genderCodeField: 'genderCode',
      },
    }]));
    expect(memberFace[0]?.cellKind).toBe('hwy-member-face');

    expect(columns[0]?.cellFields?.primaryField).toBe('email');
    expect(columns[0]?.cellClickBehavior?.kind).toBe('none');
    expect(columns[1]?.cellKind).toBe('chips');
    expect(columns[1]?.cellClickActionId).toBe('edit-roles');
  });

  it('round-trips rich column presets', () => {
    const serialized = serializeDesignerDataGridColumns(USERS_RICH_COLUMNS_PRESET);
    const parsed = parseDesignerDataGridColumns(serialized);

    expect(parsed).toHaveLength(USERS_RICH_COLUMNS_PRESET.length);
    expect(parsed.every((column) => isRichCellKind(column.cellKind))).toBe(true);
    expect(parsed.find((column) => column.key === 'email')?.cellKind).toBe('account');
    expect(parsed.find((column) => column.key === 'roles')?.cellClickActionId).toBe('edit-roles');
  });

  it('allows cell click invoke for account and plain columns with click behavior', () => {
    const accountColumn = {
      key: 'nakhebinId',
      label: 'Voter record',
      cellKind: 'account' as const,
      cellClickBehavior: { kind: 'hwy-family-household' as const },
    };
    const plainColumn = {
      key: 'familyCode',
      label: 'Family code',
      cellClickBehavior: { kind: 'hwy-family-household' as const },
    };

    expect(designerGridColumnAllowsCellClickInvoke(accountColumn, 'account')).toBe(true);
    expect(designerGridColumnAllowsCellClickInvoke(plainColumn, undefined)).toBe(true);
    expect(designerGridColumnAllowsCellClickInvoke(USERS_ACCOUNT_COLUMN_PRESET, 'account')).toBe(false);
  });

  it('reads chip values from arrays and comma-separated strings', () => {
    expect(readDesignerGridChipValues({ roles: ['ADMIN', 'DEVELOPER'] }, 'roles')).toEqual(['ADMIN', 'DEVELOPER']);
    expect(readDesignerGridChipValues({ roles: 'ADMIN, DEVELOPER' }, 'roles')).toEqual(['ADMIN', 'DEVELOPER']);
  });

  it('resolves account and link sort/filter values', () => {
    const row = {
      email: 'alice@example.com',
      username: 'alice',
      is_builtin: true,
      full_name: 'Alice Example',
    };

    expect(resolveRichCellSortValue(row, USERS_ACCOUNT_COLUMN_PRESET)).toBe('alice@example.com');
    expect(resolveRichCellFilterValue(row, USERS_ACCOUNT_COLUMN_PRESET)).toBe('alice@example.com alice');
    expect(readDesignerGridDisplayLabel(row, defaultRichCellFieldsForKind('link'))).toBe('Alice Example');
    expect(readDesignerGridRowBoolean(row, 'is_builtin')).toBe(true);
    expect(readDesignerGridRowString(row, USERS_AVATAR_COLUMN_PRESET.cellFields?.fallbackTextField)).toBe('alice');
  });

  it('executes cell click open-modal behavior in preview runtime', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[1]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        {
          key: 'full_name',
          label: 'Profile',
          cellKind: 'link',
          cellFields: defaultRichCellFieldsForKind('link'),
          cellClickBehavior: {
            kind: 'open-modal',
            modalNodeId,
            primaryKeyField: 'id',
            selectionStorePath: 'selection.id',
          },
        },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: DESIGNER_PALETTE_ITEM_ID_PROP,
      value: APP_TABLE_GRID_PALETTE_ITEM_ID,
    });

    const patches: Array<{ path: string; value: unknown }> = [];
    const updatedGridNode = state.document.nodes[gridNodeId]!;
    const column = parseDesignerDataGridColumns(updatedGridNode.props.columns)[0]!;
    const executed = executeDesignerGridCellClick(
      updatedGridNode,
      state.document,
      state.bindingDefinitions,
      { id: 'user-42', full_name: 'Alice' },
      column,
      {
        patchStore: (path, value) => {
          patches.push({ path, value });
        },
      },
    );

    expect(executed).toBe(true);
    expect(patches).toEqual([
      { path: 'selection.id', value: 'user-42' },
      { path: `ui.visibility.${modalNodeId}`, value: true },
    ]);
  });
});
