import { describe, expect, it } from 'vitest';
import { validateSettingsAttributePayload } from '../settingsAttributesValidation';

describe('validateSettingsAttributePayload', () => {
  it('normalizes a valid CUSTOM single attribute', () => {
    const result = validateSettingsAttributePayload({
      key: 'MyParam',
      label: 'My Param',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
      cardinality: 'single',
      visibility: 'BOTH',
      isRequired: true,
      viewOrder: 5,
    });

    expect(result).toMatchObject({
      key: 'myparam',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
      cardinality: 'single',
      minSelections: null,
      maxSelections: null,
      visibility: 'BOTH',
      isRequired: true,
      viewOrder: 5,
    });
  });

  it('requires baseInfoRootId for BASE_INFO attributes', () => {
    expect(() => validateSettingsAttributePayload({
      key: 'city',
      scope: 'ROLE',
      sourceType: 'BASE_INFO',
      cardinality: 'single',
    })).toThrow('baseInfoRootId is required for BASE_INFO attributes.');
  });

  it('accepts multi cardinality with min/max constraints', () => {
    const result = validateSettingsAttributePayload({
      key: 'allowed_cities',
      scope: 'ROLE',
      source_type: 'BASE_INFO',
      base_info_root_id: '103',
      cardinality: 'multi',
      min_selections: 1,
      max_selections: 3,
    });

    expect(result).toMatchObject({
      key: 'allowed_cities',
      sourceType: 'BASE_INFO',
      baseInfoRootId: '103',
      dataType: 'base_info_code',
      cardinality: 'multi',
      minSelections: 1,
      maxSelections: 3,
    });
  });

  it('rejects minSelections greater than maxSelections', () => {
    expect(() => validateSettingsAttributePayload({
      key: 'tags',
      scope: 'USER',
      sourceType: 'BASE_INFO',
      baseInfoRootId: '103',
      cardinality: 'multi',
      minSelections: 4,
      maxSelections: 2,
    })).toThrow('minSelections cannot exceed maxSelections.');
  });

  it('forces CUSTOM attributes to single cardinality', () => {
    const result = validateSettingsAttributePayload({
      key: 'tags',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
      cardinality: 'multi',
      minSelections: 1,
      maxSelections: 5,
    });

    expect(result).toMatchObject({
      sourceType: 'CUSTOM',
      cardinality: 'single',
      minSelections: null,
      maxSelections: null,
    });
  });

  it('clears min/max when cardinality is single', () => {
    const result = validateSettingsAttributePayload({
      key: 'city',
      scope: 'USER',
      sourceType: 'BASE_INFO',
      baseInfoRootId: '103',
      cardinality: 'single',
      minSelections: 2,
      maxSelections: 5,
    });

    expect(result.minSelections).toBeNull();
    expect(result.maxSelections).toBeNull();
  });

  it('accepts keys with dash, underscore, and dot', () => {
    const result = validateSettingsAttributePayload({
      key: 'Bad-Key.v2_test',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
    });

    expect(result.key).toBe('bad-key.v2_test');
  });

  it('rejects invalid key characters', () => {
    expect(() => validateSettingsAttributePayload({
      key: 'bad key',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
    })).toThrow('key may only contain lowercase letters, numbers, dash, underscore, and dot.');
  });

  it('rejects PROFILE source type because profile fields are managed separately', () => {
    expect(() => validateSettingsAttributePayload({
      key: 'gender',
      scope: 'USER',
      sourceType: 'PROFILE',
      profileField: 'gender_code',
      cardinality: 'single',
    })).toThrow('Profile fields are managed separately in Profile Fields settings.');
  });
});
