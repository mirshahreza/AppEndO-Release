import { describe, expect, it } from 'vitest';
import { stripPackageCultureOverrides } from '../packageCultureKeysSidecar';

describe('stripPackageCultureOverrides', () => {
  it('removes package keys only from the English master culture overrides', () => {
    const stripped = stripPackageCultureOverrides(
      {
        us: {
          'extx.members.column.nakhebin': 'Voter record',
          'actions.save': 'Save',
        },
        iq: {
          'extx.members.column.nakhebin': 'سجل الناخب المخصص',
        },
      },
      {
        'extx.members.column.nakhebin': 'Voter record',
      },
    );

    expect(stripped.us?.['extx.members.column.nakhebin']).toBeUndefined();
    expect(stripped.us?.['actions.save']).toBe('Save');
    expect(stripped.iq?.['extx.members.column.nakhebin']).toBe('سجل الناخب المخصص');
  });
});
