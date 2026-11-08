import {
  BUILT_IN_SITE_SHELL_ENTRY,
  HOME_SHELL_KEY,
  PUBLIC_SITE_PACKAGE_ID,
} from '../../shared/api/contracts/platform/mountConstants';
import type { PlatformShell } from '../../shared/api/contracts/platform/types';

export const PACKAGE_HOME_PORTAL_ENTRY = 'platform/home-shell.json';

export type PackageHomePortalPayload = {
  shellKey: typeof HOME_SHELL_KEY;
  name: string;
  entry: string;
  surface: 'home';
  entryMode: 'shell';
  navigationRef: string | null;
};

export function isPublicSitePackageId(packageId: string): boolean {
  return packageId.trim().toLowerCase() === PUBLIC_SITE_PACKAGE_ID;
}

export function buildPublicSiteHomePortalPayload(): PackageHomePortalPayload {
  return {
    shellKey: HOME_SHELL_KEY,
    name: 'Home',
    entry: BUILT_IN_SITE_SHELL_ENTRY,
    surface: 'home',
    entryMode: 'shell',
    navigationRef: 'home',
  };
}

export function parsePackageHomePortalPayload(raw: unknown): PackageHomePortalPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const shellKey = typeof row.shellKey === 'string' ? row.shellKey.trim() : HOME_SHELL_KEY;
  if (shellKey !== HOME_SHELL_KEY) return null;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const entry = typeof row.entry === 'string' ? row.entry.trim() : '';
  const entryMode = row.entryMode === 'shell' ? 'shell' : null;
  if (!name || !entry || entryMode !== 'shell') return null;
  const surface = typeof row.surface === 'string' ? row.surface.trim() : 'home';
  if (surface !== 'home') return null;
  const navigationRef = typeof row.navigationRef === 'string' && row.navigationRef.trim()
    ? row.navigationRef.trim()
    : null;
  return {
    shellKey: HOME_SHELL_KEY,
    name,
    entry,
    surface: 'home',
    entryMode: 'shell',
    navigationRef,
  };
}

export function applyHomeShellClaim(
  current: PlatformShell | null,
  payload: PackageHomePortalPayload,
): PlatformShell {
  const base: PlatformShell = current ?? {
    shellKey: HOME_SHELL_KEY,
    name: payload.name,
    entry: payload.entry,
    surface: payload.surface,
    enabled: true,
  };
  return {
    ...base,
    name: payload.name,
    entry: payload.entry,
    surface: payload.surface,
    enabled: true,
    entryMode: 'shell',
    redirectToSegment: null,
    redirectToCulture: null,
    navigationRef: payload.navigationRef,
  };
}
