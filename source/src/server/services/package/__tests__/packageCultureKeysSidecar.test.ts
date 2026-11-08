import { describe, expect, it } from 'vitest';
import { stripPackageCultureOverrides } from '../packageCultureKeysSidecar';

describe('stripPackageCultureOverrides', () => {
  it('removes package keys only from the English master culture overrides', () => {
    const stripped = stripPackageCultureOverrides(
      {
        us: {
          'vx.members.column.nakhebin': 'Voter record',
          'actions.save': 'Save',
        },
        iq: {
          'vx.members.column.nakhebin': 'سجل الناخب المخصص',
        },
      },
      {
        'vx.members.column.nakhebin': 'Voter record',
      },
    );

    expect(stripped.us?.['vx.members.column.nakhebin']).toBeUndefined();
    expect(stripped.us?.['actions.save']).toBe('Save');
    expect(stripped.iq?.['vx.members.column.nakhebin']).toBe('سجل الناخب المخصص');
  });
});
