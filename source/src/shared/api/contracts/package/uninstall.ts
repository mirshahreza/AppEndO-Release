export type PackageUninstallRemoveScope = {
  /** Remove registered APIs and extracted API runtime handlers. */
  apis?: boolean;
  /** Remove UI components from Client Components and extracted UI sources. */
  ui_components?: boolean;
  /** Roll back portal and navigation platform publishes. */
  portal_nav?: boolean;
  /** Remove extracted package files (pages, shell, static assets, deployment overlay). */
  files?: boolean;
  /** Execute database uninstall scripts. */
  runDbUninstallScripts?: boolean;
};

export type ResolvedPackageUninstallRemoveScope = {
  apis: boolean;
  ui_components: boolean;
  portal_nav: boolean;
  files: boolean;
  runDbUninstallScripts: boolean;
};

export const DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE: ResolvedPackageUninstallRemoveScope = {
  apis: true,
  ui_components: true,
  portal_nav: true,
  files: true,
  runDbUninstallScripts: true,
};

export function resolvePackageUninstallRemoveScope(
  scope?: PackageUninstallRemoveScope | null,
): ResolvedPackageUninstallRemoveScope {
  return {
    apis: scope?.apis !== false,
    ui_components: scope?.ui_components !== false,
    portal_nav: scope?.portal_nav !== false,
    files: scope?.files !== false,
    runDbUninstallScripts: scope?.runDbUninstallScripts !== false,
  };
}

export type PackageUninstallScopeOptionKey = keyof ResolvedPackageUninstallRemoveScope;

export type PackageUninstallCapabilityScopeOptionKey = Exclude<
  PackageUninstallScopeOptionKey,
  'runDbUninstallScripts'
>;

export type PackageUninstallScriptScopeOptionKey = Extract<
  PackageUninstallScopeOptionKey,
  'runDbUninstallScripts'
>;

export const PACKAGE_UNINSTALL_SCRIPT_SCOPE_OPTION_KEYS: PackageUninstallScriptScopeOptionKey[] = [
  'runDbUninstallScripts',
];

export function isPackageUninstallScriptScopeOptionKey(
  key: PackageUninstallScopeOptionKey,
): key is PackageUninstallScriptScopeOptionKey {
  return key === 'runDbUninstallScripts';
}

/** Static labels aligned with package capability wizard steps (see packageCapabilityWizardSteps). */
export const PACKAGE_UNINSTALL_SCOPE_LABELS: Record<PackageUninstallScopeOptionKey, string> = {
  portal_nav: 'Portal',
  apis: 'Server Functions',
  ui_components: 'Client Components',
  files: 'Deployment',
  runDbUninstallScripts: 'Uninstall Scripts',
};

/** Static hints aligned with package capability wizard step descriptions. */
export const PACKAGE_UNINSTALL_SCOPE_HINTS: Record<PackageUninstallScopeOptionKey, string> = {
  portal_nav: 'Portals published by this package, including navigation and layout dependencies.',
  apis: 'Managed server functions shipped inside the package artifact.',
  ui_components: 'Custom designer components included as mountable client capabilities.',
  files: 'Rolls back pending or applied package deployment from the platform.',
  runDbUninstallScripts: 'Runs the SQL uninstall scripts bundled with this package.',
};

export type PackageUninstallPayload = {
  removeScope?: PackageUninstallRemoveScope;
};

export function parsePackageUninstallPayload(
  body: Record<string, unknown>,
): ResolvedPackageUninstallRemoveScope {
  const removeScope = typeof body.removeScope === 'object' && body.removeScope !== null
    ? body.removeScope as PackageUninstallRemoveScope
    : undefined;

  return resolvePackageUninstallRemoveScope(removeScope);
}
