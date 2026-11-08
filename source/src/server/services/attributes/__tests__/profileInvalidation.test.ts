import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/profile/profileFieldSettingsRepository', () => ({
  hasActiveProfileFieldSettingsForFields: vi.fn(),
}));

vi.mock('../sessionContextCache', () => ({
  invalidateSessionContext: vi.fn(),
}));

import { hasActiveProfileFieldSettingsForFields } from '../../../domain/profile/profileFieldSettingsRepository';
import { invalidateSessionContextIfProfileFieldsChanged } from '../profileInvalidation';
import { invalidateSessionContext } from '../sessionContextCache';

describe('invalidateSessionContextIfProfileFieldsChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates session cache when an active profile field setting maps to a changed column', async () => {
    vi.mocked(hasActiveProfileFieldSettingsForFields).mockResolvedValue(true);

    await invalidateSessionContextIfProfileFieldsChanged(42, { genderCode: '101.2' });

    expect(hasActiveProfileFieldSettingsForFields).toHaveBeenCalledWith(['gender_code']);
    expect(invalidateSessionContext).toHaveBeenCalledWith(42);
  });

  it('invalidates session cache when shell identity profile fields change', async () => {
    await invalidateSessionContextIfProfileFieldsChanged(42, { firstname: 'Ada' });

    expect(hasActiveProfileFieldSettingsForFields).not.toHaveBeenCalled();
    expect(invalidateSessionContext).toHaveBeenCalledWith(42);
  });

  it('skips lookup when payload has no mapped profile columns', async () => {
    await invalidateSessionContextIfProfileFieldsChanged(42, { email: 'ada@example.com' });

    expect(hasActiveProfileFieldSettingsForFields).not.toHaveBeenCalled();
    expect(invalidateSessionContext).not.toHaveBeenCalled();
  });
});
