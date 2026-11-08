import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/profile/profileColumnsRepository', () => ({
  listUserProfileTableColumns: vi.fn(),
}));

import { listUserProfileTableColumns } from '../../../domain/profile/profileColumnsRepository';

describe('profileFields', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('loads profile fields lazily on first access', async () => {
    vi.mocked(listUserProfileTableColumns).mockResolvedValue(['firstname', 'lastname']);

    const { loadConfigurableProfileFields } = await import('../profileFields');
    const fields = await loadConfigurableProfileFields();

    expect(fields.map((field) => field.profileField)).toContain('firstname');
    expect(listUserProfileTableColumns).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent lazy loads', async () => {
    vi.mocked(listUserProfileTableColumns).mockImplementation(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      return ['phone'];
    });

    const { loadConfigurableProfileFields } = await import('../profileFields');
    const [first, second] = await Promise.all([
      loadConfigurableProfileFields(),
      loadConfigurableProfileFields(),
    ]);

    expect(first).toEqual(second);
    expect(listUserProfileTableColumns).toHaveBeenCalledTimes(1);
  });

  it('falls back to static allowlist before lazy load completes', async () => {
    const { isAllowedProfileField } = await import('../profileFields');

    expect(isAllowedProfileField('firstname')).toBe(true);
    expect(isAllowedProfileField('unknown_field')).toBe(false);
  });

  it('returns cached ids without re-querying the database', async () => {
    vi.mocked(listUserProfileTableColumns).mockResolvedValue(['nickname']);

    const module = await import('../profileFields');
    await module.loadConfigurableProfileFields();
    await module.getConfigurableProfileFieldIds();

    expect(listUserProfileTableColumns).toHaveBeenCalledTimes(1);
  });
});
