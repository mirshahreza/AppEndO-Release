import { describe, expect, it } from 'vitest';
import { AppShell } from '../AppShell';
import { AppShellHeader } from '../AppShellHeader';
import { AppShellSidebar } from '../AppShellSidebar';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_MAIN_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
} from '../../../shared/ui/surfaceClasses';

describe('AppShell', () => {
  it('exports standalone shell components without AdminLayout dependency', () => {
    expect(AppShell).toBeDefined();
    expect(AppShellHeader).toBeDefined();
    expect(AppShellSidebar).toBeDefined();
  });

  it('uses the same admin shell surface tokens', () => {
    expect(ADMIN_SHELL_ROOT_CLASS).toContain('admin-shell-surface');
    expect(ADMIN_SHELL_ROOT_CLASS).toContain('shell-atmosphere');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).toContain('select-none');
    expect(ADMIN_SHELL_MAIN_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('select-none');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('header-line-pattern');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('menu-line-pattern');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('menu-line-pattern');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('header-line-pattern');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('shadow-content-host');
  });
});
