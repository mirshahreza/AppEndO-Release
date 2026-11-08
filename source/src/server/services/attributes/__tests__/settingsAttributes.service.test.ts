import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../errors/HttpError';

vi.mock('../../../domain/attributes/settingsAttributesRepository', () => ({
  listSettingsAttributeRows: vi.fn(),
  findSettingsAttributeById: vi.fn(),
  findSettingsAttributeKeyConflict: vi.fn(),
  findProfileFieldConflict: vi.fn(),
  insertSettingsAttribute: vi.fn(),
  updateSettingsAttribute: vi.fn(),
  deleteSettingsAttribute: vi.fn(),
  reorderSettingsAttributes: vi.fn(),
}));

vi.mock('../../../domain/attributes/valueRepository', () => ({
  countUserValuesForSettingsAttribute: vi.fn(),
  countRoleValuesForSettingsAttribute: vi.fn(),
  listUserIdsAffectedBySettingsAttribute: vi.fn(),
}));

vi.mock('../sessionContextCache', () => ({
  invalidateSessionContextForUsers: vi.fn(),
}));

vi.mock('../roleAttributesCache', () => ({
  invalidateAllRoleAttributes: vi.fn(),
  preloadAllRoleAttributesCache: vi.fn(),
}));

vi.mock('../../../utils/baseInfoValidation', () => ({
  ensureBaseInfoRoot: vi.fn(),
}));

vi.mock('../../platform/attributeLabelTranslations.service', () => ({
  upsertAttributeLabelTranslation: vi.fn(),
  removeAttributeLabelTranslation: vi.fn(),
  renameAttributeLabelTranslation: vi.fn(),
}));

import {
  createSettingsAttribute,
  deleteSettingsAttributeRecord,
  listSettingsAttributes,
  reorderSettingsAttributeRecords,
  updateSettingsAttributeRecord,
} from '../settingsAttributes.service';
import {
  deleteSettingsAttribute,
  findSettingsAttributeById,
  findSettingsAttributeKeyConflict,
  insertSettingsAttribute,
  listSettingsAttributeRows,
  reorderSettingsAttributes,
  updateSettingsAttribute,
} from '../../../domain/attributes/settingsAttributesRepository';
import { countRoleValuesForSettingsAttribute, countUserValuesForSettingsAttribute, listUserIdsAffectedBySettingsAttribute } from '../../../domain/attributes/valueRepository';
import { ensureBaseInfoRoot } from '../../../utils/baseInfoValidation';

const actor = { userId: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'], isAdmin: true };

describe('settingsAttributes.service CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUserIdsAffectedBySettingsAttribute).mockResolvedValue([]);
  });

  it('lists definitions for a valid scope', async () => {
    vi.mocked(listSettingsAttributeRows).mockResolvedValue([{ id: 1, key: 'city', scope: 'USER' } as never]);

    const result = await listSettingsAttributes('USER');

    expect(listSettingsAttributeRows).toHaveBeenCalledWith('USER');
    expect(result.body.items).toHaveLength(1);
  });

  it('rejects invalid scope on list', async () => {
    await expect(listSettingsAttributes('INVALID')).rejects.toBeInstanceOf(HttpError);
  });

  it('creates a BASE_INFO definition after root validation', async () => {
    vi.mocked(findSettingsAttributeKeyConflict).mockResolvedValue(undefined);
    vi.mocked(insertSettingsAttribute).mockResolvedValue(12);

    const result = await createSettingsAttribute(actor, {
      key: 'allowed_cities',
      scope: 'ROLE',
      sourceType: 'BASE_INFO',
      baseInfoRootId: '103',
      cardinality: 'multi',
      maxSelections: 3,
    });

    expect(ensureBaseInfoRoot).toHaveBeenCalledWith('103', 'baseInfoRootId');
    expect(insertSettingsAttribute).toHaveBeenCalled();
    expect(result.body).toEqual({ success: true, id: 12 });
    expect(result.statusCode).toBe(201);
  });

  it('rejects duplicate keys within the same scope', async () => {
    vi.mocked(findSettingsAttributeKeyConflict).mockResolvedValue({ id: 9 });

    await expect(createSettingsAttribute(actor, {
      key: 'city',
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'string',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'key "city" already exists for scope USER.',
    });
  });

  it('updates an existing definition', async () => {
    vi.mocked(findSettingsAttributeById).mockResolvedValue({
      id: 4,
      scope: 'USER',
      key: 'city',
      source_type: 'BASE_INFO',
    } as never);
    vi.mocked(findSettingsAttributeKeyConflict).mockResolvedValue(undefined);

    const result = await updateSettingsAttributeRecord(actor, 4, {
      label: 'City',
      sourceType: 'BASE_INFO',
      baseInfoRootId: '103',
      cardinality: 'single',
    });

    expect(updateSettingsAttribute).toHaveBeenCalledWith(4, expect.objectContaining({
      scope: 'USER',
      baseInfoRootId: '103',
    }), 1);
    expect(result.body).toEqual({ success: true });
  });

  it('returns 404 when deleting a missing definition', async () => {
    vi.mocked(findSettingsAttributeById).mockResolvedValue(undefined);

    await expect(deleteSettingsAttributeRecord(404)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('blocks delete for built-in definitions', async () => {
    vi.mocked(findSettingsAttributeById).mockResolvedValue({
      id: 2,
      scope: 'USER',
      source_type: 'CUSTOM',
      is_builtin: true,
    } as never);

    await expect(deleteSettingsAttributeRecord(2)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Built-in settings attributes cannot be deleted.',
    });
    expect(deleteSettingsAttribute).not.toHaveBeenCalled();
  });

  it('deletes an existing definition', async () => {
    vi.mocked(findSettingsAttributeById).mockResolvedValue({
      id: 2,
      scope: 'ROLE',
      source_type: 'BASE_INFO',
      is_builtin: false,
    } as never);
    vi.mocked(countUserValuesForSettingsAttribute).mockResolvedValue(0);
    vi.mocked(countRoleValuesForSettingsAttribute).mockResolvedValue(0);

    const result = await deleteSettingsAttributeRecord(2);

    expect(deleteSettingsAttribute).toHaveBeenCalledWith(2, 'ROLE');
    expect(result.body).toEqual({ success: true });
  });

  it('reorders definitions for a scope', async () => {
    vi.mocked(listSettingsAttributeRows).mockResolvedValue([
      { id: 1, scope: 'USER' },
      { id: 2, scope: 'USER' },
      { id: 3, scope: 'USER' },
    ] as never);

    const result = await reorderSettingsAttributeRecords(actor, 'USER', [3, 1, 2]);

    expect(reorderSettingsAttributes).toHaveBeenCalledWith('USER', [3, 1, 2], 1);
    expect(result.body).toEqual({ success: true });
  });

  it('rejects reorder payloads with invalid ids', async () => {
    await expect(reorderSettingsAttributeRecords(actor, 'USER', ['reorder'])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('blocks delete when values exist', async () => {
    vi.mocked(findSettingsAttributeById).mockResolvedValue({
      id: 2,
      scope: 'ROLE',
      source_type: 'BASE_INFO',
      is_builtin: false,
    } as never);
    vi.mocked(countUserValuesForSettingsAttribute).mockResolvedValue(1);
    vi.mocked(countRoleValuesForSettingsAttribute).mockResolvedValue(0);

    await expect(deleteSettingsAttributeRecord(2)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(deleteSettingsAttribute).not.toHaveBeenCalled();
  });
});
