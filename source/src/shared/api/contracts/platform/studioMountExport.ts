import type { VerticalAppManifest } from '../package-manifest/verticalApp';

export type StudioMountExportInclude = {
  routes?: boolean;
  apis?: boolean;
  dbObjects?: boolean;
  mcpServers?: boolean;
  staticAssets?: boolean;
  shell?: boolean;
  navigation?: boolean;
};

export type StudioMountExportRequest = {
  packageId: string;
  name?: string;
  version?: string;
  kind?: 'extension' | 'vertical-app';
  applyPolicy?: 'propose' | 'auto';
  requiredAppVersion?: string;
  description?: string;
  createdBy?: string;
  include?: StudioMountExportInclude;
  routeBindingIds?: number[];
  functionIds?: string[];
  dbObjectNames?: string[];
  mcpServerIds?: string[];
  staticAssetKeys?: string[];
};

export type StudioMountExportDiscoverRoute = {
  bindingId: number;
  routePattern: string;
  pageKey: string;
  exportable: boolean;
  reason?: string;
};

export type StudioMountExportDiscoverApi = {
  functionId: string;
  name: string;
  method: string;
  tagged: boolean;
};

export type StudioMountExportDiscover = {
  schema: 'studio-mount-export-discover';
  schemaVersion: '1.0.0';
  mountId: string;
  ownerPackageId: string | null;
  suggestedKind: 'extension' | 'vertical-app';
  routes: StudioMountExportDiscoverRoute[];
  apis: StudioMountExportDiscoverApi[];
  dbObjects: Array<{ objectName: string; objectType: string; source: 'owner-package' }>;
  mcpServers: Array<{ id: string; label: string; source: 'owner-package' }>;
  staticAssets: Array<{ assetKey: string; path: string; source: 'owner-package' }>;
  shell: {
    shellKey: string;
    entry: string;
    exportable: boolean;
    source: 'package' | 'core-bridge';
  };
};

export type StudioMountExportPreview = {
  schema: 'studio-mount-export-preview';
  schemaVersion: '1.0.0';
  mountId: string;
  packageId: string;
  kind: 'extension' | 'vertical-app';
  fileName: string;
  manifest: VerticalAppManifest | Record<string, unknown>;
  warnings: string[];
  skippedRoutes: string[];
  generatedAt: string;
};
