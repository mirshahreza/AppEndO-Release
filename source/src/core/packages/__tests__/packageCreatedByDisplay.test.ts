import { describe, expect, it } from 'vitest';
import {
  isTechnicalPackageCreatedBy,
  PACKAGE_CREATED_BY_FALLBACK,
  resolvePackageCreatedByDisplay,
} from '../packageCreatedByDisplay';

describe('packageCreatedByDisplay', () => {
  it('detects technical kebab-case labels', () => {
    expect(isTechnicalPackageCreatedBy('pack-cms-package')).toBe(true);
    expect(isTechnicalPackageCreatedBy('install-remote-hubs')).toBe(true);
    expect(isTechnicalPackageCreatedBy('admin')).toBe(false);
    expect(isTechnicalPackageCreatedBy('Sys Admin <admin@example.com>')).toBe(false);
  });

  it('keeps wizard and profile labels', () => {
    expect(resolvePackageCreatedByDisplay('AppEndO Team', null)).toBe('AppEndO Team');
    expect(resolvePackageCreatedByDisplay('Jane Doe <jane@example.com>', 'admin')).toBe(
      'Jane Doe <jane@example.com>',
    );
  });

  it('prefers upload actor over technical stored label', () => {
    expect(resolvePackageCreatedByDisplay('install-remote-hubs', 'admin')).toBe('admin');
  });

  it('falls back when both stored and actor are technical', () => {
    expect(resolvePackageCreatedByDisplay('pack-cms-package', 'pack-cms-package')).toBe(
      PACKAGE_CREATED_BY_FALLBACK,
    );
  });
});
