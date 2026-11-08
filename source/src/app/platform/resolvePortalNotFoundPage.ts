import type { PlatformRuntimeConfig, PlatformShell } from '../../shared/api/contracts/platform/types';
import { resolveRegistryShellForPortal } from './platformConfigHelpers';

export type PortalNotFoundLookup = {
  portalSegment: string;
  shellKey: string;
};

/**
 * Resolve the PlatformShell that owns a portal's custom 404 page.
 * PortalContext.shellKey may be a designer layout key (not the registry shellKey),
 * so prefer the portal segment / home-shell mapping first.
 */
export function resolvePortalShellForNotFound(
  config: PlatformRuntimeConfig,
  portal: PortalNotFoundLookup | null | undefined,
): PlatformShell | undefined {
  return resolveRegistryShellForPortal(config, portal);
}

/** Returns a designer loaderRef when the portal has a custom not-found page configured. */
export function resolvePortalNotFoundPageRef(
  config: PlatformRuntimeConfig,
  portal: PortalNotFoundLookup | null | undefined,
): string | null {
  const shell = resolvePortalShellForNotFound(config, portal);
  const ref = shell?.notFoundPageRef?.trim();
  return ref ? ref : null;
}
