export type PackageListApiItem = {
  packageId: string;
  displayName: string;
  version: string;
  installStatus: string;
  activeInstalledVersion: string | null;
  pluginKind?: 'extension' | 'vertical-app' | null;
  deploymentStatus?: 'none' | 'pending' | 'applied';
  createdAt?: string | null;
  createdBy?: string | null;
};

export type PackageDetailVersion = {
  version: string;
  artifactPath: string;
  manifestPath: string;
  artifactSha256: string;
  requiredAppVersion: string;
  createdAt: string;
  createdBy?: string;
};

export type PackageManifestDependency = {
  packageId: string;
  versionRange: string;
};

export type PackageManifestApi = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  entry: string;
  timeoutMs?: number;
  auth?: 'public' | 'authenticated' | 'admin';
};

export type PackageManifestUiComponent = {
  componentKey: string;
  slotId: string;
  entry: string;
  order?: number;
  propsSchemaRef?: string;
};

export type PackageManifestDbObject = {
  objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
  objectName: string;
  installScript: string;
  uninstallScript?: string;
  seedScript?: string;
  targetDataSource?: string;
  installMode?: 'required' | 'optional';
};

export type PackageManifestPortal = {
  segment: string;
  entry: string;
};

export type PackageManifestNavigation = {
  id: string;
  entry: string;
};

export type PackageManifestWorkflow = {
  scopeKey: string;
  key: string;
  entry: string;
};

export type PackageBundleManifest = {
  id: string;
  name: string;
  version: string;
  requiredAppVersion: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  dependencies?: PackageManifestDependency[];
  libraries?: Array<{ name: string; versionRange?: string }>;
  capabilities: {
    apis: PackageManifestApi[];
    ui_components: PackageManifestUiComponent[];
    portals?: PackageManifestPortal[];
    navigations?: PackageManifestNavigation[];
    workflows?: PackageManifestWorkflow[];
    db_objects: PackageManifestDbObject[];
  };
};

export type PackageDetail = {
  packageId: string;
  displayName: string;
  version: string;
  installStatus: string;
  activeInstalledVersion: string | null;
  bundleManifest: PackageBundleManifest | null;
  installSql?: string | null;
  uninstallSql?: string | null;
  pluginKind?: 'extension' | 'vertical-app' | null;
  deploymentStatus?: 'none' | 'pending' | 'applied';
  catalogVersions?: string[];
};

export type DependencyGraph = {
  edges: Array<{
    fromPackageId: string;
    toPackageId: string;
    versionRange: string;
    satisfied: boolean;
  }>;
  issues: string[];
};

export type PackageRow = PackageListApiItem & {
  createdAt: string | null;
  createdBy: string | null;
  dependencyHealthy: boolean;
  dependencyIssues: string[];
};

export type InstallOverrideValue = 'allow' | 'deny';

export type UploadManifestPreview = {
  id?: string;
  name?: string;
  version?: string;
  requiredAppVersion?: string;
  capabilities?: {
    apis?: unknown[];
    ui_components?: unknown[];
    workflows?: unknown[];
    db_objects?: unknown[];
  };
};

export type PackageStatusFilter = 'all' | 'installed' | 'not_installed' | 'failed' | 'busy';

export type PackageDetailSectionTab =
  | 'apis'
  | 'ui_components'
  | 'portals'
  | 'install_scripts'
  | 'uninstall_scripts';

export type PackagesToastState = { type: 'success' | 'error'; text: string } | null;

export type InstallPackageResult = {
  deploymentStatus?: 'none' | 'pending' | 'applied';
  pluginKind?: 'extension' | 'vertical-app';
};

export type InstallPackagePayload = {
  version: string;
  targetDataSource: string;
  overridePolicy: {
    apis: InstallOverrideValue;
    ui_components: InstallOverrideValue;
    db_objects: InstallOverrideValue;
  };
  /** When the package ships optional seed rows, the installer may skip them. Defaults to true. */
  installOptionalRecords?: boolean;
};

export const DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY: InstallPackagePayload['overridePolicy'] = {
  apis: 'allow',
  ui_components: 'allow',
  db_objects: 'allow',
};
