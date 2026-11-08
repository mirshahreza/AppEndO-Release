import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/baseInfoValidation', () => ({
  ensureBaseInfoCode: vi.fn(),
}));

import { ensureBaseInfoCode } from '../../../utils/baseInfoValidation';
import {
  parseAttributeValuesPayload,
  parseStoredAttributeValue,
  serializeAttributeValue,
  validateAttributeValueForSettingsAttribute,
} from '../valueValidation';
import type { SettingsAttributeRow } from '../../../domain/attributes/settingsAttributesRepository';

const baseDefinition = (overrides: Partial<SettingsAttributeRow> = {}): SettingsAttributeRow => ({
  id: 1,
  key: 'city',
  label: 'City',
  scope: 'USER',
  source_type: 'BASE_INFO',
  base_info_root_id: '103',
  data_type: 'base_info_code',
  cardinality: 'single',
  min_selections: null,
  max_selections: null,
  visibility: 'BOTH',
  is_required: false,
  is_active: true,
  is_builtin: false,
  user_editable: false,
  user_edit_policy: 'NONE',
  profile_field: null,
  view_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  created_by_username: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
  updated_by_username: null,
  ...overrides,
});

describe('parseAttributeValuesPayload', () => {
  it('parses settingsAttributeId/value pairs', () => {
    const result = parseAttributeValuesPayload({
      values: [
        { settingsAttributeId: 1, value: '103.5' },
        { settingsAttributeId: 2, value: ['103.5', '103.12'] },
      ],
    });

    expect(result).toEqual([
      { settingsAttributeId: 1, value: '103.5' },
      { settingsAttributeId: 2, value: ['103.5', '103.12'] },
    ]);
  });

  it('rejects duplicate settings attribute ids', () => {
    expect(() => parseAttributeValuesPayload({
      values: [
        { settingsAttributeId: 1, value: 'a' },
        { settingsAttributeId: 1, value: 'b' },
      ],
    })).toThrow('Duplicate settingsAttributeId 1.');
  });
});

describe('validateAttributeValueForSettingsAttribute', () => {
  it('validates BASE_INFO single values', async () => {
    const result = await validateAttributeValueForSettingsAttribute(
      baseDefinition(),
      '103.5',
    );

    expect(result).toBe('103.5');
    expect(ensureBaseInfoCode).toHaveBeenCalledWith('103.5', '103', 'city');
  });

  it('enforces max selections for multi values', async () => {
    await expect(validateAttributeValueForSettingsAttribute(
      baseDefinition({
        key: 'allowed_cities',
        cardinality: 'multi',
        max_selections: 2,
      }),
      ['103.1', '103.2', '103.3'],
    )).rejects.toThrow('"allowed_cities" allows at most 2 selection(s).');
  });

  it('validates CUSTOM number scalar', async () => {
    const result = await validateAttributeValueForSettingsAttribute(
      baseDefinition({
        source_type: 'CUSTOM',
        data_type: 'number',
        base_info_root_id: null,
      }),
      '42',
    );

    expect(result).toBe(42);
  });

  it('allows clearing optional values', async () => {
    const result = await validateAttributeValueForSettingsAttribute(baseDefinition(), null);
    expect(result).toBeNull();
  });

  it('rejects missing required values', async () => {
    await expect(validateAttributeValueForSettingsAttribute(
      baseDefinition({ is_required: true }),
      '',
    )).rejects.toThrow('"city" is required.');
  });
});

describe('serializeAttributeValue', () => {
  it('round-trips through parseStoredAttributeValue', () => {
    const serialized = serializeAttributeValue(['103.5', '103.12']);
    expect(parseStoredAttributeValue(serialized)).toEqual(['103.5', '103.12']);
  });
});
