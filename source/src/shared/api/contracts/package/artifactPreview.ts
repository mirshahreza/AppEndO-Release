import type { InstallOverrideValue } from '../package-manifest/types';

export type PackageArtifactType = 'package' | 'unknown';

export type PackageConflictPreviewItem = {
  objectType: 'apis' | 'ui_components' | 'db_objects' | 'mcp_servers' | 'workflow_actions';
  conflictKey: string;
  ownerPackageId: string;
  blocked: boolean;
};

export type PackageInstallPreviewRequest = {
  packageId: string;
  version?: string;
  targetDataSource?: string;
  overridePolicy?: {
    apis?: InstallOverrideValue;
    ui_components?: InstallOverrideValue;
    db_objects?: InstallOverrideValue;
    mcp_servers?: InstallOverrideValue;
  };
};

export type PackageInstallPreview = {
  schema: 'package-install-preview';
  schemaVersion: '1.0.0';
  artifactType: 'package';
  packageId: string;
  version: string;
  displayName: string;
  pluginKind: 'extension' | 'vertical-app';
  manifest: Record<string, unknown>;
  conflicts: PackageConflictPreviewItem[];
  dependencyIssues: string[];
  effectivePolicy: Record<string, InstallOverrideValue>;
  installBlocked: boolean;
  blockReason?: string;
};

export type PackageImportPreview = {
  schema: 'package-import-preview';
  schemaVersion: '1.0.0';
  artifactType: PackageArtifactType;
  fileName: string;
  artifactSha256: string;
  validationErrors: string[];
  duplicateVersion: boolean;
  packageId?: string;
  version?: string;
  displayName?: string;
  manifest?: Record<string, unknown>;
  installPreview?: PackageInstallPreview;
};

export type PackageBundleDownloadItem = {
  artifactType: 'package';
  id: string;
  version: string;
  fileName: string;
  downloadUrl: string;
};

export type PackageBundleDownloadPlan = {
  schema: 'package-bundle-download';
  schemaVersion: '1.0.0';
  items: PackageBundleDownloadItem[];
};
