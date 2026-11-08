import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsAttributeWithValueRow } from '../../../domain/attributes/valueRepository';
import {
  findMissingRequiredFromRows,
  formatMissingRequiredAttributesMessage,
  resolveMissingRequiredAttributes,
  resolveUserScopedAttributeValue,
  shouldBypassRequiredAttributes,
} from '../requiredAttributes.service';

vi.mock('../../../domain/attributes/valueRepository', () => ({
  listUserAttributeRows: vi.fn(),
  listRoleAttributeRows: vi.fn(),
}));

import {
  listRoleAttributeRows,
  listUserAttributeRows,
} from '../../../domain/attributes/valueRepository';

const baseRow = (
  overrides: Partial<SettingsAttributeWithValueRow> = {},
): SettingsAttributeWithValueRow => ({
  id: 1,
  key: 'city',
  label: 'City',
  scope: 'USER',
  source_type: 'CUSTOM',
  base_info_root_id: null,
  profile_field: null,
  data_type: 'string',
  cardinality: 'single',
  min_selections: null,
  max_selections: null,
  visibility: 'BOTH',
  is_required: true,
  is_active: true,
  is_builtin: false,
  user_editable: false,
  user_edit_policy: 'NONE',
  view_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  created_by_username: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
  updated_by_username: null,
  value_id: null,
  value_text: null,
  ...overrides,
});

describe('resolveUserScopedAttributeValue', () => {
  it('falls back to role default when user value is empty', () => {
    const roleRowsByKey = new Map([
      ['city', baseRow({ id: 2, scope: 'ROLE', key: 'city', value_text: '"north"' })],
    ]);

    expect(resolveUserScopedAttributeValue(
      baseRow({ value_text: null }),
      roleRowsByKey,
    )).toBe('north');
  });
});

describe('findMissingRequiredFromRows', () => {
  it('flags required USER attributes without user or role values', () => {
    const missing = findMissingRequiredFromRows(
      [baseRow({ id: 1, key: 'department', label: 'Department' })],
      [baseRow({ id: 2, scope: 'ROLE', key: 'department', is_required: false, value_text: null })],
    );

    expect(missing).toEqual([{
      settingsAttributeId: 1,
      key: 'department',
      scope: 'USER',
      sourceType: 'CUSTOM',
      contextKey: 'user.department',
      label: 'Department',
    }]);
  });

  it('accepts role fallback for required USER attributes', () => {
    const missing = findMissingRequiredFromRows(
      [baseRow({ id: 1, key: 'department', is_required: true, value_text: null })],
      [baseRow({ id: 2, scope: 'ROLE', key: 'department', is_required: false, value_text: '"sales"' })],
    );

    expect(missing).toEqual([]);
  });

  it('flags required ROLE attributes missing on the primary role', () => {
    const missing = findMissingRequiredFromRows(
      [],
      [baseRow({ id: 3, scope: 'ROLE', key: 'region', label: 'Region', is_required: true, value_text: null })],
    );

    expect(missing).toEqual([{
      settingsAttributeId: 3,
      key: 'region',
      scope: 'ROLE',
      sourceType: 'CUSTOM',
      contextKey: 'role.region',
      label: 'Region',
    }]);
  });
});

describe('resolveMissingRequiredAttributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns missing attributes for non-admin users', async () => {
    vi.mocked(listUserAttributeRows).mockResolvedValue([
      baseRow({ id: 1, key: 'department', label: 'Department' }),
    ]);
    vi.mocked(listRoleAttributeRows).mockResolvedValue([]);

    const missing = await resolveMissingRequiredAttributes(42, ['USER']);

    expect(missing).toHaveLength(1);
    expect(missing[0]?.key).toBe('department');
  });

  it('skips enforcement for ADMIN accounts', async () => {
    const missing = await resolveMissingRequiredAttributes(1, ['ADMIN']);

    expect(missing).toEqual([]);
    expect(listUserAttributeRows).not.toHaveBeenCalled();
  });
});

describe('shouldBypassRequiredAttributes', () => {
  it('returns true only for ADMIN role', () => {
    expect(shouldBypassRequiredAttributes(['ADMIN'])).toBe(true);
    expect(shouldBypassRequiredAttributes(['USER'])).toBe(false);
    expect(shouldBypassRequiredAttributes(['DEVELOPER'])).toBe(false);
  });
});

describe('formatMissingRequiredAttributesMessage', () => {
  it('formats a single missing attribute label', () => {
    expect(formatMissingRequiredAttributesMessage([{
      settingsAttributeId: 1,
      key: 'department',
      scope: 'USER',
      sourceType: 'CUSTOM',
      contextKey: 'user.department',
      label: 'Department',
    }])).toContain('Department');
  });
});
