import { describe, expect, it } from 'vitest';
import { stripPackageCultureOverrides } from '../packageCultureKeysSidecar';

describe('stripPackageCultureOverrides', () => {
  it('removes package keys only from the English master culture overrides', () => {
    const stripped = stripPackageCultureOverrides(
      {
        us: {
          'hwy.members.column.nakhebin': 'Voter record',
          'actions.save': 'Save',
        },
        iq: {
          'hwy.members.column.nakhebin': 'سجل الناخب المخصص',
        },
      },
      {
        'hwy.members.column.nakhebin': 'Voter record',
      },
    );

    expect(stripped.us?.['hwy.members.column.nakhebin']).toBeUndefined();
    expect(stripped.us?.['actions.save']).toBe('Save');
    expect(stripped.iq?.['hwy.members.column.nakhebin']).toBe('سجل الناخب المخصص');
  });
});
