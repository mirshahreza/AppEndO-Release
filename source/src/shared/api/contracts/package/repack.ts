export type PackageRepackItemCategory =
  | 'apis'
  | 'ui_components'
  | 'ui_routes'
  | 'db_objects'
  | 'static_assets'
  | 'portals'
  | 'navigations'
  | 'pages'
  | 'shell'
  | 'designer_layouts'
  | 'designer_shells'
  | 'experience'
  | 'workflows';

export type PackageRepackChangedItem = {
  itemId: string;
  category: PackageRepackItemCategory;
  label: string;
  entryPath: string;
};

export type PackageRepackDescriptionMode = 'replace' | 'append';

export type PackageRepackDriftPreview = {
  packageId: string;
  baseVersion: string;
  baseDescription: string | null;
  pluginKind: 'extension' | 'vertical-app';
  changedItems: PackageRepackChangedItem[];
  changedByCategory: Record<PackageRepackItemCategory, PackageRepackChangedItem[]>;
  hasChanges: boolean;
};

export type PackageRepackItemDiff = {
  itemId: string;
  label: string;
  entryPath: string;
  baseline: string;
  current: string;
  diff: string;
  truncated: boolean;
};

export type PackageRepackAdditionFile = {
  entryPath: string;
  content: string;
  contentBase64?: string;
};

export type PackageRepackRemovalsPayload = {
  apis?: string[];
  ui_components?: string[];
  portals?: string[];
  navigations?: string[];
  workflows?: string[];
};

export type PackageRepackAdditionsPayload = {
  apis?: Array<{
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    entry: string;
    timeoutMs: number;
    auth: 'public' | 'authenticated' | 'admin';
  }>;
  ui_components?: Array<{
    componentKey: string;
    slotId: string;
    entry: string;
    order: number;
    designerDraftId?: string;
    draftEntry?: string;
  }>;
  ui_routes?: Array<{
    pageKey: string;
    entry: string;
    suggestedRoutePattern?: string;
    suggestedMountId?: string;
  }>;
  navigation_patches?: Array<{ navigationId: string; entry: string }>;
  culture_keys?: Array<{ entry: string }>;
  home_portal?: Array<{ entry: string }>;
  edge_models?: Array<{ id: string; entry: string }>;
  edge_apis?: Array<{ id: string; edgeModelId: string; entry: string }>;
  edge_model_studio_meta?: Array<{ edgeModelId: string; entry: string }>;
  record_policies?: Array<{ id: string; edgeModelId: string; entry: string }>;
  record_policy_bindings?: Array<{ edgeModelId: string; entry: string }>;
  scope_dimensions?: Array<{ key: string; entry: string }>;
  portals?: Array<{ segment: string; entry: string }>;
  navigations?: Array<{ id: string; entry: string }>;
  workflows?: Array<{
    scopeKey: string;
    key: string;
    entry: string;
  }>;
  db_objects?: Array<{
    objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
    objectName: string;
    installScript: string;
    uninstallScript?: string;
    installMode?: 'required' | 'optional';
  }>;
  files: PackageRepackAdditionFile[];
};

export type PackageRepackPayload = {
  version: string;
  description?: string;
  descriptionMode?: PackageRepackDescriptionMode;
  createdBy?: string;
  additions?: PackageRepackAdditionsPayload;
  removals?: PackageRepackRemovalsPayload;
};

export type PackageRepackResult = {
  packageId: string;
  version: string;
  baseVersion: string;
  preservedVersions: string[];
  installed: boolean;
  deploymentStatus?: 'none' | 'pending' | 'applied';
};

export const PACKAGE_REPACK_CATEGORY_LABELS: Record<PackageRepackItemCategory, string> = {
  apis: 'APIs',
  ui_components: 'UI components',
  ui_routes: 'UI routes',
  db_objects: 'Database objects',
  static_assets: 'Static assets',
  portals: 'Portals',
  navigations: 'Navigation',
  pages: 'Pages',
  shell: 'Shell',
  designer_layouts: 'Designer layouts',
  designer_shells: 'Designer shells',
  experience: 'Experience',
  workflows: 'Workflows',
};
