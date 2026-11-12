import { describe, expect, it } from 'vitest';
import { cloneProfilesForSchemaSync } from '../cloneProfilesForSchemaSync';

describe('cloneProfilesForSchemaSync', () => {
  it('includes oss and hawiety for default full publish', () => {
    expect(
      cloneProfilesForSchemaSync({
        skipOss: false,
        publishPackageIds: ['hawiety'],
      }),
    ).toEqual(['oss', 'hawiety']);
  });

  it('skips oss when skipOss', () => {
    expect(
      cloneProfilesForSchemaSync({
        skipOss: true,
        publishPackageIds: ['hawiety'],
      }),
    ).toEqual(['hawiety']);
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
