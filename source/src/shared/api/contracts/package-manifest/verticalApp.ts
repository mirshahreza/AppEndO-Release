import type {
  CapabilityApi,
  CapabilityDbObject,
  CapabilityMcpServer,
} from '../../../../core/packages/PackageManifestValidator';
import type { ExperienceManifest } from '../platform/experienceManifest';

export type VerticalAppExperienceBlock = ExperienceManifest;

export type VerticalAppShellCapability = {
  key: string;
  name: string;
  entry: string;
  surface: string;
  navigationEntry?: string;
};

export type VerticalAppPageCapability = {
  pageKey: string;
  title: string;
  entry: string;
  defaultRoles?: string[];
};

export type VerticalAppDesignerLayoutCapability = {
  slug: string;
  title: string;
  entry: string;
};

export type VerticalAppDesignerShellCapability = {
  shellKey: string;
  title: string;
  entry: string;
};

export type VerticalAppStaticAssetCapability = {
  assetKey: string;
  path: string;
  mime?: string;
  public?: boolean;
};

export type VerticalAppDeploymentMount = {
  id: string;
  pathPrefix: string;
  name: string;
  defaultRoute: string;
  authProfile?: {
    requireAuth?: boolean;
    allowedRoles?: string[];
  };
  experienceConfig?: {
    locale?: string;
    calendar?: 'jalali' | 'gregorian';
    direction?: 'rtl' | 'ltr';
    timezone?: string;
  };
};

export type VerticalAppDeploymentShellRule = {
  pathPrefix: string;
  shellKey: string;
  priority?: number;
};

export type VerticalAppDeploymentRoute = {
  routePattern: string;
  pageKey: string;
  auth?: {
    roles?: string[];
  };
  nav?: {
    label: string;
    icon?: string;
    group?: string;
    order?: number;
  };
};

export type VerticalAppDeploymentBlueprint = {
  applyPolicy: 'propose' | 'auto';
  mount: VerticalAppDeploymentMount;
  shellRule: VerticalAppDeploymentShellRule;
  routes: VerticalAppDeploymentRoute[];
};

export type VerticalAppManifest = {
  $schemaVersion: '1.1' | '1.2' | '1.3';
  kind: 'vertical-app';
  id: string;
  name: string;
  version: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  requiredAppVersion: string;
  dependencies?: Array<{ packageId: string; versionRange: string }>;
  libraries?: Array<{ name: string; versionRange?: string }>;
  branding?: {
    logoAssetKey?: string;
  };
  /** ER-4 packaged operator routing manifest (v1.2). */
  experience?: VerticalAppExperienceBlock;
  capabilities: {
    shell: VerticalAppShellCapability;
    pages?: VerticalAppPageCapability[];
    designer_layouts?: VerticalAppDesignerLayoutCapability[];
    designer_shells?: VerticalAppDesignerShellCapability[];
    static_assets?: VerticalAppStaticAssetCapability[];
    apis: CapabilityApi[];
    db_objects: CapabilityDbObject[];
    mcp_servers?: CapabilityMcpServer[];
  };
  deployment: VerticalAppDeploymentBlueprint;
  overridePolicy: {
    apis: 'allow' | 'deny';
    ui_components?: 'allow' | 'deny';
    db_objects: 'allow' | 'deny';
    mcp_servers?: 'allow' | 'deny';
  };
  integrity: {
    algorithm: 'sha256';
    artifactHash: string;
  };
};

export type PluginDeploymentStatus = 'none' | 'pending' | 'applied';

export type VerticalAppDeploymentPreview = {
  schema: 'package-deployment-preview';
  schemaVersion: '1.0.0';
  packageId: string;
  version: string;
  applyPolicy: 'propose' | 'auto';
  deployment: VerticalAppDeploymentBlueprint;
  generatedAt: string;
};

export function buildPackageShellLoaderRef(packageId: string): string {
  return `package:${packageId}:shell`;
}

export function buildPackagePageLoaderRef(packageId: string, pageKey: string): string {
  return `${packageId}:${pageKey}`;
}

export function isVerticalAppManifest(value: unknown): value is VerticalAppManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === 'vertical-app'
    || record.$schemaVersion === '1.1'
    || record.$schemaVersion === '1.2'
    || record.$schemaVersion === '1.3';
}
