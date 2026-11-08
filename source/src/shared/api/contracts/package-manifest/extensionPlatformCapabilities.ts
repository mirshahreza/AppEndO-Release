export type ExtensionPlatformCapabilitiesPortalCompile = {
  navigationIds: string[];
  shellKeys: string[];
  routeBindingIds: number[];
  pageModulesCreated: number;
  pageModulesUpdated: number;
  bindingsRemoved: number;
};

export type ExtensionPlatformCapabilitiesApplied = {
  schema: 'package-platform-capabilities-applied';
  schemaVersion: '1.0.0';
  packageId: string;
  version: string;
  appliedAt: string;
  navigations: string[];
  portals: string[];
  portalCompile?: ExtensionPlatformCapabilitiesPortalCompile;
};

export function isExtensionPlatformCapabilitiesApplied(
  value: unknown,
): value is ExtensionPlatformCapabilitiesApplied {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as ExtensionPlatformCapabilitiesApplied).schema === 'package-platform-capabilities-applied';
}
