import { describe, expect, it } from 'vitest';
import { resolveConfigurableProfileFields } from '../profileFieldRegistry';

describe('resolveConfigurableProfileFields', () => {
  it('always includes the virtual profile_image field', () => {
    const fields = resolveConfigurableProfileFields([
      'user_id',
      'firstname',
      'lastname',
      'profile_image_body',
      'profile_image_body_xs',
      'profile_image_mime',
      'profile_image_size',
      'created_at',
      'updated_at',
    ]);

    expect(fields.map((field) => field.profileField)).toContain('profile_image');
    expect(fields.find((field) => field.profileField === 'profile_image')?.dataKind).toBe('image');
  });

  it('auto-discovers new profile table columns that are not in the registry', () => {
    const fields = resolveConfigurableProfileFields([
      'user_id',
      'firstname',
      'middle_name',
      'created_at',
      'updated_at',
    ]);

    const middleName = fields.find((field) => field.profileField === 'middle_name');
    expect(middleName).toMatchObject({
      profileField: 'middle_name',
      label: 'Middle Name',
      dataKind: 'string',
      dbColumn: 'middle_name',
    });
  });
});
