import { describe, expect, it } from 'vitest';
import {
  adminShellChromeDataAttributesForClassName,
  isPublishedAdminShellContentHostClassName,
  isPublishedAdminShellHeaderClassName,
  normalizePublishedAdminShellClassName,
} from '../normalizePublishedAdminShellChrome';

describe('normalizePublishedAdminShellClassName', () => {
  it('detects frozen designer header and content host class strings', () => {
    const header = 'admin-shell-chrome relative z-30 flex h-[calc(52px+env(safe-area-inset-top))] shrink-0';
    const content = 'bg-white border-t border-shell-content-border shadow-content-host lg:border-s ltr:lg:!rounded-tl-[var(--admin-shell-content-radius,8px)]';

    expect(isPublishedAdminShellHeaderClassName(header)).toBe(true);
    expect(isPublishedAdminShellContentHostClassName(content)).toBe(true);
  });

  it('strips ltr-only rounding and adds logical radius + header band tokens', () => {
    const content = 'bg-white border-shell-content-border shadow-content-host ltr:lg:!rounded-tl-[var(--admin-shell-content-radius,8px)]';
    const normalized = normalizePublishedAdminShellClassName(content);

    expect(normalized).not.toContain('ltr:lg');
    expect(normalized).toContain('rounded-ss-');

    const header = 'w-full admin-shell-chrome z-30 flex h-[calc(52px+env(safe-area-inset-top))] lg:h-[59px]';
    const normalizedHeader = normalizePublishedAdminShellClassName(header);

    expect(normalizedHeader).toContain('admin-shell-header-band');
    expect(normalizedHeader).toContain('lg:!h-[59px]');
    expect(adminShellChromeDataAttributesForClassName(normalizedHeader)).toEqual({
      'data-admin-shell-header': 'true',
    });
    expect(adminShellChromeDataAttributesForClassName(normalized)).toEqual({
      'data-admin-shell-content-host': 'true',
    });
  });
});
