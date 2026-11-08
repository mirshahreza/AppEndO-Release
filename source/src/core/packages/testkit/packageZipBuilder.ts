/**
 * Official package builder — shared by CLI scaffold, reference packages, and p-08 exit tests.
 */
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../packageArtifactHash';
import type { PackageManifest } from '../PackageManifestValidator';
import {
  PACKAGE_API_META_SCHEMA,
  PACKAGE_API_META_SCHEMA_VERSION,
  resolveApiMetaEntryPath,
} from '../packageApiMetaSidecar';

export type PackageZipSpec = {
  packageId: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: PackageManifest['dependencies'];
  libraries?: PackageManifest['libraries'];
  overridePolicy?: Partial<PackageManifest['overridePolicy']>;
  apis?: PackageManifest['capabilities']['apis'];
  uiComponents?: PackageManifest['capabilities']['ui_components'];
  uiRoutes?: NonNullable<PackageManifest['capabilities']['ui_routes']>;
  dbObjects?: PackageManifest['capabilities']['db_objects'];
  mcpServers?: PackageManifest['capabilities']['mcp_servers'];
  edgeModels?: PackageManifest['capabilities']['edge_models'];
  edgeApis?: PackageManifest['capabilities']['edge_apis'];
  edgeModelStudioMeta?: PackageManifest['capabilities']['edge_model_studio_meta'];
  installHooks?: PackageManifest['capabilities']['install_hooks'];
  extraFiles?: Array<{ path: string; content: string | Buffer }>;
};

export type BuildPackageZipOptions = {
  /** ZIP entry paths to omit (negative smoke-test fixtures). */
  omitEntries?: string[];
};

export const REFERENCE_PACKAGE_SPECS: PackageZipSpec[] = [
  {
    packageId: 'ref-hello-widget',
    name: 'Reference Hello Widget',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'hello-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/HelloWidget.js',
        order: 5,
      },
    ],
  },
  {
    packageId: 'ref-hello-api',
    name: 'Reference Hello API',
    version: '1.0.0',
    apis: [
      {
        id: 'ref-hello-api.health',
        method: 'GET',
        path: '/packages/ref-hello-api/health',
        entry: 'edge/health.js',
        auth: 'public',
      },
    ],
  },
];

export const REFERENCE_UI_ROUTE_PACKAGE_SPEC: PackageZipSpec = {
  packageId: 'ref-hello-page',
  name: 'Reference Hello Page',
  version: '1.0.0',
  uiRoutes: [
    {
      pageKey: 'hello-page',
      entry: 'ui/HelloPage.js',
      suggestedRoutePattern: 'packages/ref-hello-page/hello',
    },
  ],
};

function uiEntrySource(componentKey: string, packageId: string): string {
  const safeName = componentKey.replace(/[^A-Za-z0-9_]/g, '_');
  return `export default function ${safeName}() {
  return { type: 'div', props: { 'data-package-id': '${packageId}', 'data-component-key': '${componentKey}' }, children: 'Hello from ${packageId}' };
}
`;
}

function pageEntrySource(pageKey: string, packageId: string): string {
  const safeName = pageKey.replace(/[^A-Za-z0-9_]/g, '_');
  return `export default function ${safeName}() {
  return { type: 'div', props: { 'data-package-id': '${packageId}', 'data-page-key': '${pageKey}' }, children: 'Page from ${packageId}' };
}
`;
}

function apiEntrySource(packageId: string): string {
  return `export default async function handler(_req, res) {
  return res.json({ success: true, packageId: '${packageId}' });
}
`;
}

function edgeModelJsonSource(modelId: string): string {
  const now = new Date().toISOString();
  return `${JSON.stringify({
    id: modelId,
    dataSourceId: 'default',
    schema: null,
    objectName: modelId.replace(/^em_/, ''),
    objectType: 'TABLE',
    sequelize: { modelName: modelId, tableName: modelId.replace(/^em_/, '') },
    columns: [
      {
        name: 'id', field: 'id', dataType: 'string', sequelizeType: 'STRING',
        allowNull: false, isPrimaryKey: true, isForeignKey: false,
      },
    ],
    primaryKey: 'id',
    associations: [],
    schemaFingerprint: 'testkit',
    readOnly: false,
    labels: { title: modelId },
    status: 'ready',
    created_at: now,
    updated_at: now,
  }, null, 2)}\n`;
}

function edgeApiJsonSource(apiId: string, edgeModelId: string): string {
  return `${JSON.stringify({
    id: apiId,
    edgeModelId,
    key: apiId.replace(/^ea_/, ''),
    label: apiId,
    basePath: `/api/testkit/${apiId.replace(/^ea_/, '')}`,
    operations: [],
    accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    openapi: { tags: [] },
    publishedAt: null,
    version: 1,
    runtime: { useGlobalConfig: true },
  }, null, 2)}\n`;
}

function edgeModelStudioMetaJsonSource(edgeModelId: string): string {
  const now = new Date().toISOString();
  return `${JSON.stringify({
    edgeModelId,
    tags: [],
    columnMeta: [],
    associationMeta: [],
    extensions: {},
    created_at: now,
    updated_at: now,
  }, null, 2)}\n`;
}

function installHookSource(hookId: string): string {
  return `export default async function ${hookId.replace(/[^A-Za-z0-9_]/g, '_')}(api) {
  api.log('testkit install hook "${hookId}" ran');
}
`;
}

function apiMetaSidecarSource(
  auth: 'public' | 'authenticated' | 'admin',
): string {
  return `${JSON.stringify({
    schema: PACKAGE_API_META_SCHEMA,
    schemaVersion: PACKAGE_API_META_SCHEMA_VERSION,
    auth,
    timeoutMs: 10_000,
    engineType: 'SANDBOX_JS',
  }, null, 2)}\n`;
}

export function buildPackageManifest(spec: PackageZipSpec): Omit<PackageManifest, 'integrity'> & {
  integrity: { algorithm: 'sha256'; artifactHash: string };
} {
  return {
    $schemaVersion: '1.0',
    id: spec.packageId,
    name: spec.name,
    version: spec.version,
    ...(spec.description ? { description: spec.description } : {}),
    requiredAppVersion: '>=1.0.0',
    dependencies: spec.dependencies ?? [],
    ...(spec.libraries?.length ? { libraries: spec.libraries } : {}),
    capabilities: {
      apis: spec.apis ?? [],
      ui_components: spec.uiComponents ?? [],
      ui_routes: spec.uiRoutes,
      db_objects: spec.dbObjects ?? [],
      mcp_servers: spec.mcpServers ?? [],
      edge_models: spec.edgeModels ?? [],
      edge_apis: spec.edgeApis ?? [],
      edge_model_studio_meta: spec.edgeModelStudioMeta ?? [],
      install_hooks: spec.installHooks ?? [],
    },
    overridePolicy: {
      apis: spec.overridePolicy?.apis ?? 'deny',
      ui_components: spec.overridePolicy?.ui_components ?? 'deny',
      db_objects: spec.overridePolicy?.db_objects ?? 'deny',
      mcp_servers: spec.overridePolicy?.mcp_servers ?? 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };
}

function shouldOmitEntry(path: string, omitEntries?: string[]): boolean {
  return omitEntries?.includes(path) ?? false;
}

export function buildPackageZipBuffer(spec: PackageZipSpec, options?: BuildPackageZipOptions): Buffer {
  const manifest = buildPackageManifest(spec);

  const zip = new AdmZip();
  const omitEntries = options?.omitEntries;

  for (const api of manifest.capabilities.apis) {
    if (!shouldOmitEntry(api.entry, omitEntries)) {
      zip.addFile(api.entry, Buffer.from(apiEntrySource(spec.packageId), 'utf8'));
    }
    if (api.auth !== undefined && !shouldOmitEntry(api.entry, omitEntries)) {
      const metaEntry = resolveApiMetaEntryPath(api.entry);
      if (!shouldOmitEntry(metaEntry, omitEntries)) {
        zip.addFile(metaEntry, Buffer.from(apiMetaSidecarSource(api.auth), 'utf8'));
      }
    }
  }
  for (const ui of manifest.capabilities.ui_components) {
    if (!shouldOmitEntry(ui.entry, omitEntries)) {
      zip.addFile(ui.entry, Buffer.from(uiEntrySource(ui.componentKey, spec.packageId), 'utf8'));
    }
  }
  for (const route of manifest.capabilities.ui_routes ?? []) {
    if (!shouldOmitEntry(route.entry, omitEntries)) {
      zip.addFile(route.entry, Buffer.from(pageEntrySource(route.pageKey, spec.packageId), 'utf8'));
    }
  }
  for (const db of manifest.capabilities.db_objects) {
    if (!shouldOmitEntry(db.installScript, omitEntries)) {
      zip.addFile(db.installScript, Buffer.from(`-- install ${db.objectName}\nSELECT 1;\n`, 'utf8'));
    }
    if (db.uninstallScript && !shouldOmitEntry(db.uninstallScript, omitEntries)) {
      zip.addFile(db.uninstallScript, Buffer.from(`-- uninstall ${db.objectName}\nSELECT 1;\n`, 'utf8'));
    }
    if (db.seedScript && !shouldOmitEntry(db.seedScript, omitEntries)) {
      zip.addFile(db.seedScript, Buffer.from(`-- seed ${db.objectName}\nSELECT 1;\n`, 'utf8'));
    }
  }
  for (const model of manifest.capabilities.edge_models) {
    if (!shouldOmitEntry(model.entry, omitEntries)) {
      zip.addFile(model.entry, Buffer.from(edgeModelJsonSource(model.id), 'utf8'));
    }
  }
  for (const api of manifest.capabilities.edge_apis) {
    if (!shouldOmitEntry(api.entry, omitEntries)) {
      zip.addFile(api.entry, Buffer.from(edgeApiJsonSource(api.id, api.edgeModelId), 'utf8'));
    }
  }
  for (const meta of manifest.capabilities.edge_model_studio_meta) {
    if (!shouldOmitEntry(meta.entry, omitEntries)) {
      zip.addFile(meta.entry, Buffer.from(edgeModelStudioMetaJsonSource(meta.edgeModelId), 'utf8'));
    }
  }
  for (const hook of manifest.capabilities.install_hooks) {
    if (!shouldOmitEntry(hook.entry, omitEntries)) {
      zip.addFile(hook.entry, Buffer.from(installHookSource(hook.id), 'utf8'));
    }
  }
  for (const file of spec.extraFiles ?? []) {
    if (!shouldOmitEntry(file.path, omitEntries)) {
      zip.addFile(file.path, Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8'));
    }
  }

  manifest.integrity.artifactHash = computePackageArtifactHashFromZip(zip);
  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  return zip.toBuffer();
}

export function buildScaffoldPackageZip(packageId: string, version = '0.1.0'): Buffer {
  const displayName = packageId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return buildPackageZipBuffer({
    packageId,
    name: displayName,
    version,
    uiComponents: [
      {
        componentKey: `${packageId}-widget`,
        slotId: 'core.dashboard.widgets',
        entry: 'ui/Widget.js',
        order: 10,
      },
    ],
  });
}
