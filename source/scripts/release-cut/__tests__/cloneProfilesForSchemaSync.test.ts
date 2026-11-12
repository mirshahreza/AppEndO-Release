import { describe, expect, it } from 'vitest';
import { cloneProfilesForSchemaSync } from '../cloneProfilesForSchemaSync';

describe('cloneProfilesForSchemaSync', () => {
  it('includes oss and vertical for default full publish', () => {
    expect(
      cloneProfilesForSchemaSync({
        skipOss: false,
        publishPackageIds: ['vertical'],
      }),
    ).toEqual(['oss', 'vertical']);
  });

  it('skips oss when skipOss', () => {
    expect(
      cloneProfilesForSchemaSync({
        skipOss: true,
        publishPackageIds: ['vertical'],
      }),
    ).toEqual(['vertical']);
  });

  it('returns oss only when no mapped publish packages', () => {
    expect(
      cloneProfilesForSchemaSync({
        skipOss: false,
        publishPackageIds: [],
      }),
    ).toEqual(['oss']);
  });
});
