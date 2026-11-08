import { describe, expect, it } from 'vitest';
import {
  buildLiveDesignerRelativePath,
  buildLiveDesignerRelativePathFromSlug,
  parseComponentDesignerEditSlug,
  parseLiveDesignerComponentPath,
} from '../componentDesignerRoute';

describe('live-designer routes', () => {
  it('parses canonical edit/{folder}/{name} and legacy live-designer paths', () => {
    expect(parseLiveDesignerComponentPath('edit/general/my-widget')).toBe('general/my-widget');
    expect(parseLiveDesignerComponentPath('client-components/edit/cms/home')).toBe('cms/home');
    expect(parseLiveDesignerComponentPath('live-designer/general/my-widget')).toBe('general/my-widget');
    expect(parseLiveDesignerComponentPath('client-components/live-designer/cms/home')).toBe('cms/home');
    expect(parseLiveDesignerComponentPath('general/my-widget')).toBeNull();
    expect(parseLiveDesignerComponentPath('live-designer')).toBeNull();
  });

  it('does not treat live-designer or edit paths as classic edit slug', () => {
    expect(parseComponentDesignerEditSlug('live-designer/general/my-widget')).toBeNull();
    expect(parseComponentDesignerEditSlug('edit/general/my-widget')).toBeNull();
    expect(parseComponentDesignerEditSlug('general/my-widget')).toBe('general/my-widget');
  });

  it('builds canonical edit relative paths', () => {
    expect(buildLiveDesignerRelativePath({ folder: 'general', name: 'my-widget' })).toBe(
      'client-components/edit/my-widget',
    );
    expect(buildLiveDesignerRelativePathFromSlug('cms/home')).toBe(
      'client-components/edit/home',
    );
  });
});
