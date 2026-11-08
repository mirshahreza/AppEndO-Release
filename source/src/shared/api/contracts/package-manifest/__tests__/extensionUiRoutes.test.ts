import { describe, expect, it } from 'vitest';
import {
  buildPackageUiModuleUrl,
  decodePackageUiModuleKey,
  readPackageUiModuleKeyFromParams,
} from '../extensionUiRoutes';

describe('package UI module URLs', () => {
  it('keeps nested component keys as path segments', () => {
    expect(buildPackageUiModuleUrl('cms', 'general/cms-vocab-languages', '1.3.0')).toBe(
      '/api/packages/cms/ui/general/cms-vocab-languages?v=1.3.0',
    );
    expect(buildPackageUiModuleUrl('demo-package', 'summary-widget', '1.0.0')).toBe(
      '/api/packages/demo-package/ui/summary-widget?v=1.0.0',
    );
  });

  it('reads splat and percent-encoded module keys', () => {
    expect(decodePackageUiModuleKey('general%2Fcms-vocab-languages')).toBe('general/cms-vocab-languages');
    expect(readPackageUiModuleKeyFromParams({ '0': 'general/cms-vocab-languages' })).toBe(
      'general/cms-vocab-languages',
    );
    expect(readPackageUiModuleKeyFromParams({ componentKey: 'cms-site-brand' })).toBe('cms-site-brand');
  });
});
