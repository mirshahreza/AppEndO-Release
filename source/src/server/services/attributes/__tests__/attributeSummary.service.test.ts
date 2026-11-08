import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/base-info/treeRepository', () => ({
  listBaseInfoOptionsRows: vi.fn(),
}));

vi.mock('../../../domain/attributes/valueRepository', () => ({
  listUserAttributeRows: vi.fn(),
}));

vi.mock('../../../domain/profile/profileFieldSettingsRepository', () => ({
  listActiveProfileFieldSettingRows: vi.fn(),
}));

vi.mock('../sessionContext.service', () => ({
  getSessionContextForUser: vi.fn(),
}));

import { listBaseInfoOptionsRows } from '../../../domain/base-info/treeRepository';
import { listUserAttributeRows } from '../../../domain/attributes/valueRepository';
import { listActiveProfileFieldSettingRows } from '../../../domain/profile/profileFieldSettingsRepository';
import { getSessionContextForUser } from '../sessionContext.service';
import { getClientAttributeSummary } from '../attributeSummary.service';

const mockedGetSessionContextForUser = vi.mocked(getSessionContextForUser);
const mockedListUserRows = vi.mocked(listUserAttributeRows);
const mockedListProfileFieldSettings = vi.mocked(listActiveProfileFieldSettingRows);
const mockedListBaseInfoOptions = vi.mocked(listBaseInfoOptionsRows);

describe('getClientAttributeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListBaseInfoOptions.mockResolvedValue([
      { id: '103.5', label: 'Tehran' },
      { id: '103.12', label: 'Isfahan' },
    ]);
  });

  it('returns labeled display values for resolved user attributes', async () => {
    mockedGetSessionContextForUser.mockResolvedValue({
      serverContext: {
        'user.allowed_cities': ['103.5', '103.12'],
      },
      clientContext: {},
    });
    mockedListUserRows.mockResolvedValue([
      {
        id: 1,
        key: 'allowed_cities',
        label: 'Allowed Cities',
        scope: 'USER',
        source_type: 'BASE_INFO',
        base_info_root_id: '103',
        profile_field: null,
        data_type: 'base_info_code',
        cardinality: 'multi',
        min_selections: null,
        max_selections: null,
        visibility: 'CLIENT',
        is_required: false,
        is_active: true,
        is_builtin: false,
        user_editable: false,
        user_edit_policy: 'NONE' as const,
        view_order: 10,
        created_at: '2026-01-01',
        created_by: null,
        created_by_username: null,
        updated_at: null,
        updated_by: null,
        updated_by_username: null,
        value_id: 1,
        value_text: '["103.5","103.12"]',
      },
    ]);
    mockedListProfileFieldSettings.mockResolvedValue([]);

    const items = await getClientAttributeSummary(42);

    expect(items).toEqual([
      {
        key: 'allowed_cities',
        label: 'Allowed Cities',
        displayValue: 'Tehran, Isfahan',
        view_order: 10,
      },
    ]);
  });

  it('skips attributes without resolved values', async () => {
    mockedGetSessionContextForUser.mockResolvedValue({
      serverContext: {},
      clientContext: {},
    });
    mockedListUserRows.mockResolvedValue([
      {
        id: 2,
        key: 'secret_scope',
        label: null,
        scope: 'USER',
        source_type: 'CUSTOM',
        base_info_root_id: null,
        profile_field: null,
        data_type: 'string',
        cardinality: 'single',
        min_selections: null,
        max_selections: null,
        visibility: 'SERVER',
        is_required: false,
        is_active: true,
        is_builtin: false,
        user_editable: false,
        user_edit_policy: 'NONE' as const,
        view_order: 1,
        created_at: '2026-01-01',
        created_by: null,
        created_by_username: null,
        updated_at: null,
        updated_by: null,
        updated_by_username: null,
        value_id: 2,
        value_text: '"internal"',
      },
    ]);
    mockedListProfileFieldSettings.mockResolvedValue([]);

    const items = await getClientAttributeSummary(42);

    expect(items).toEqual([]);
  });
});
