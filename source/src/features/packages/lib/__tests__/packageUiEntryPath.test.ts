import { describe, expect, it } from 'vitest';
import { buildPackageUiEntryPath, buildPackageUiEntryPathFromParts, buildPackageUiRoutePageKey } from '../packageUiEntryPath';

describe('packageUiEntryPath', () => {
  it('builds ui/{folder}/{name}.tsx from component path', () => {
    expect(buildPackageUiEntryPath('my-tests/c1')).toBe('ui/my-tests/c1.tsx');
    expect(buildPackageUiEntryPathFromParts('my-tests', 'c1')).toBe('ui/my-tests/c1.tsx');
  });

  it('uses the designer page name as the ui_routes pageKey, not the folder prefix', () => {
    expect(buildPackageUiRoutePageKey('general/cms-contents-list')).toBe('cms-contents-list');
    expect(buildPackageUiRoutePageKey('cms/cms-contents-list')).toBe('cms-contents-list');
  });
});
