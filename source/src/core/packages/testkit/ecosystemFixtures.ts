/**
 * Ecosystem ZIP fixtures — maps historical ecosystem ZIP phase-1 scenarios (P0+P1)
 * to shared package builders.
 */
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { buildPackageZipBuffer, type PackageZipSpec } from './packageZipBuilder';
import {
  buildVerticalAppZipBuffer,
  REFERENCE_INVENTORY_VERTICAL_APP_SPEC,
  type VerticalAppPackageSpec,
} from './verticalAppPackageBuilder';

export const ECOSYSTEM_PREFIX = 'eco';

export function plApiOnlySpec(suffix = 'api'): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-${suffix}`;
  return {
    packageId,
    name: `Ecosystem API ${suffix}`,
    version: '1.0.0',
    apis: [
      {
        id: 'health',
        method: 'GET',
        path: `/packages/${packageId}/health`,
        entry: 'api/health.js',
        auth: 'public',
      },
    ],
  };
}

export function plApiOnlyV11Spec(suffix = 'api'): PackageZipSpec {
  const base = plApiOnlySpec(suffix);
  return {
    ...base,
    version: '1.1.0',
    apis: [
      ...(base.apis ?? []),
      {
        id: 'version',
        method: 'GET',
        path: `/packages/${base.packageId}/version`,
        entry: 'api/version.js',
        auth: 'public',
      },
    ],
  };
}

export function plUiDashSpec(suffix = 'dash'): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-${suffix}`;
  return {
    packageId,
    name: `Ecosystem Widget ${suffix}`,
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: `${packageId}-widget`,
        slotId: 'core.dashboard.widgets',
        entry: 'ui/DashboardWidget.js',
        order: 10,
      },
    ],
  };
}

export type EcosystemSlotId =
  | 'core.sidebar.navigation'
  | 'core.settings.sections'
  | 'core.toolbar.actions';

export function plUiSlotSpec(slotId: EcosystemSlotId): PackageZipSpec {
  const slotSuffix = slotId.split('.').pop() ?? 'slot';
  const packageId = `${ECOSYSTEM_PREFIX}-pl-slot-${slotSuffix}`;
  return {
    packageId,
    name: `Ecosystem Slot ${slotSuffix}`,
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: `${packageId}-ui`,
        slotId,
        entry: `ui/${slotSuffix}.js`,
        order: 10,
      },
    ],
  };
}

export function plDepBaseSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-dep-base`;
  return {
    packageId,
    name: 'Ecosystem Dep Base',
    version: '1.0.0',
    apis: [
      {
        id: 'ping',
        method: 'GET',
        path: `/packages/${packageId}/ping`,
        entry: 'api/base.js',
        auth: 'public',
      },
    ],
  };
}

export function plDepChildSpec(): PackageZipSpec {
  const baseId = `${ECOSYSTEM_PREFIX}-dep-base`;
  const packageId = `${ECOSYSTEM_PREFIX}-dep-child`;
  return {
    packageId,
    name: 'Ecosystem Dep Child',
    version: '1.0.0',
    dependencies: [{ packageId: baseId, versionRange: '>=1.0.0' }],
    uiComponents: [
      {
        componentKey: 'child-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/ChildWidget.js',
        order: 5,
      },
    ],
  };
}

export function plApiConflictOwnerSpec(sharedPath: string): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-conflict-owner`;
  return {
    packageId,
    name: 'Ecosystem API Conflict Owner',
    version: '1.0.0',
    apis: [
      {
        id: 'shared',
        method: 'GET',
        path: sharedPath,
        entry: 'api/shared-owner.js',
        auth: 'public',
      },
    ],
  };
}

export function plApiConflictDenySpec(sharedPath: string): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-conflict-deny`;
  return {
    packageId,
    name: 'Ecosystem API Conflict Deny',
    version: '1.0.0',
    apis: [
      {
        id: 'shared-deny',
        method: 'GET',
        path: sharedPath,
        entry: 'api/shared-deny.js',
        auth: 'public',
      },
    ],
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function plApiConflictAllowSpec(sharedPath: string): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-conflict-allow`;
  return {
    packageId,
    name: 'Ecosystem API Conflict Allow',
    version: '1.0.0',
    apis: [
      {
        id: 'shared-allow',
        method: 'GET',
        path: sharedPath,
        entry: 'api/shared-allow.js',
        auth: 'public',
      },
    ],
    overridePolicy: {
      apis: 'allow',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function plUiConflictOwnerSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-ui-conflict-owner`;
  return {
    packageId,
    name: 'Ecosystem UI Conflict Owner',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'shared-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/SharedWidget.js',
      },
    ],
  };
}

export function plUiRoutesSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-ui-routes`;
  return {
    packageId,
    name: 'Ecosystem UI Routes',
    version: '1.0.0',
    uiRoutes: [
      {
        pageKey: 'eco-page',
        entry: 'ui/EcoPage.js',
        suggestedRoutePattern: `packages/${packageId}/eco-page`,
      },
    ],
  };
}

export function plDbUnsafeSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-db-unsafe`;
  const objectName = 'eco_db_unsafe_items';
  return {
    packageId,
    name: 'Ecosystem DB Unsafe',
    version: '1.0.0',
    dbObjects: [
      {
        objectType: 'table',
        objectName,
        installScript: 'scripts/install/eco_db_unsafe_items.sql',
      },
    ],
  };
}

export function plFullStackSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-fullstack`;
  return {
    packageId,
    name: 'Ecosystem Full Stack',
    version: '1.0.0',
    apis: [
      {
        id: 'status',
        method: 'GET',
        path: `/packages/${packageId}/status`,
        entry: 'api/status.js',
        auth: 'public',
      },
    ],
    uiComponents: [
      {
        componentKey: `${packageId}-widget`,
        slotId: 'core.dashboard.widgets',
        entry: 'ui/FullStackWidget.js',
        order: 5,
      },
    ],
    dbObjects: [
      {
        objectType: 'table',
        objectName: 'eco_fullstack_items',
        installScript: 'db/install/eco_fullstack_items.sql',
        uninstallScript: 'db/uninstall/eco_fullstack_items.sql',
      },
    ],
  };
}

const ECO_MCP_LOCAL_ID = 'fs';

export function plMcpManifestSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-mcp-owner`;
  return {
    packageId,
    name: 'Ecosystem MCP Owner',
    version: '1.0.0',
    mcpServers: [
      {
        id: ECO_MCP_LOCAL_ID,
        label: 'Filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      },
    ],
  };
}

export function plMcpTransportsSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-mcp-transports`;
  return {
    packageId,
    name: 'Ecosystem MCP Transports',
    version: '1.0.0',
    mcpServers: [
      {
        id: 'remote-http',
        label: 'Remote HTTP',
        transport: 'http',
        url: 'https://example.com/mcp',
      },
      {
        id: 'remote-sse',
        label: 'Remote SSE',
        transport: 'sse',
        url: 'https://example.com/mcp/sse',
      },
    ],
  };
}

export function plMcpConflictDenySpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-mcp-conflict-deny`;
  return {
    packageId,
    name: 'Ecosystem MCP Conflict Deny',
    version: '1.0.0',
    mcpServers: [
      {
        id: ECO_MCP_LOCAL_ID,
        label: 'Filesystem Deny',
        transport: 'stdio',
        command: 'npx',
      },
    ],
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function plApiAuthMatrixSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-api-auth`;
  return {
    packageId,
    name: 'Ecosystem API Auth Matrix',
    version: '1.0.0',
    apis: [
      {
        id: 'public',
        method: 'GET',
        path: `/packages/${packageId}/public`,
        entry: 'api/public.js',
        auth: 'public',
      },
      {
        id: 'authenticated',
        method: 'GET',
        path: `/packages/${packageId}/authenticated`,
        entry: 'api/authenticated.js',
        auth: 'authenticated',
      },
      {
        id: 'admin',
        method: 'GET',
        path: `/packages/${packageId}/admin`,
        entry: 'api/admin.js',
        auth: 'admin',
      },
      {
        id: 'write',
        method: 'POST',
        path: `/packages/${packageId}/write`,
        entry: 'api/write.js',
        auth: 'authenticated',
      },
    ],
  };
}

export function plDbObjectTypesSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-db-types`;
  return {
    packageId,
    name: 'Ecosystem DB Object Types',
    version: '1.0.0',
    dbObjects: [
      {
        objectType: 'table',
        objectName: 'eco_types_base',
        installScript: 'db/install/eco_types_base.sql',
        uninstallScript: 'db/uninstall/eco_types_base.sql',
      },
      {
        objectType: 'view',
        objectName: 'eco_types_view',
        installScript: 'db/install/eco_types_view.sql',
        uninstallScript: 'db/uninstall/eco_types_view.sql',
      },
      {
        objectType: 'index',
        objectName: 'eco_types_idx',
        installScript: 'db/install/eco_types_idx.sql',
        uninstallScript: 'db/uninstall/eco_types_idx.sql',
      },
      {
        objectType: 'function',
        objectName: 'eco_types_fn',
        installScript: 'db/install/eco_types_fn.sql',
        uninstallScript: 'db/uninstall/eco_types_fn.sql',
      },
      {
        objectType: 'trigger',
        objectName: 'eco_types_trigger',
        installScript: 'db/install/eco_types_trigger.sql',
        uninstallScript: 'db/uninstall/eco_types_trigger.sql',
      },
      {
        objectType: 'seed',
        objectName: 'eco_types_seed',
        installScript: 'db/install/eco_types_seed.sql',
        seedScript: 'db/seed/eco_types_seed.sql',
      },
    ],
  };
}

export function plPropsSchemaRefSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-props-schema`;
  return {
    packageId,
    name: 'Ecosystem Props Schema Ref',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: `${packageId}-widget`,
        slotId: 'core.dashboard.widgets',
        entry: 'ui/PropsWidget.js',
        propsSchemaRef: 'schemas/widget-props.json',
        order: 8,
      },
    ],
    extraFiles: [
      {
        path: 'schemas/widget-props.json',
        content: `${JSON.stringify({
          type: 'object',
          properties: { title: { type: 'string' } },
        }, null, 2)}\n`,
      },
    ],
  };
}

export function plSmokeFailUnknownSlotSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-smoke-unknown-slot`;
  return {
    packageId,
    name: 'Ecosystem Smoke Unknown Slot',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'bad-slot-widget',
        slotId: 'core.unknown.slot',
        entry: 'ui/BadSlotWidget.js',
      },
    ],
  };
}

export function plSmokeFailMissingEntrySpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-smoke-missing-entry`;
  return {
    packageId,
    name: 'Ecosystem Smoke Missing Entry',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'missing-entry-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/MissingEntryWidget.js',
      },
    ],
  };
}

export function plInstallFailMissingDepSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-install-missing-dep`;
  return {
    packageId,
    name: 'Ecosystem Install Missing Dep',
    version: '1.0.0',
    dependencies: [{ packageId: `${ECOSYSTEM_PREFIX}-ghost-missing`, versionRange: '>=1.0.0' }],
    apis: [
      {
        id: 'needs-base',
        method: 'GET',
        path: `/packages/${packageId}/needs-base`,
        entry: 'api/needs-base.js',
        auth: 'public',
      },
    ],
  };
}

export function plInstallFailMcpConflictSpec(): PackageZipSpec {
  return plMcpConflictDenySpec();
}

export function buildSmokeFailMissingEntryZip(): { buffer: Buffer; originalName: string } {
  const spec = plSmokeFailMissingEntrySpec();
  return {
    buffer: buildPackageZipBuffer(spec, { omitEntries: ['ui/MissingEntryWidget.js'] }),
    originalName: 'eco-smoke-missing-entry-1.0.0.zip',
  };
}

export function buildDuplicateUploadZip(): { buffer: Buffer; originalName: string } {
  return {
    buffer: buildPackageZipBuffer(plApiOnlySpec()),
    originalName: 'eco-pl-api-1.0.0.zip',
  };
}

export function vaReferenceInventorySpec(): VerticalAppPackageSpec {
  return {
    ...REFERENCE_INVENTORY_VERTICAL_APP_SPEC,
    packageId: `${ECOSYSTEM_PREFIX}-va-reference`,
    name: 'Ecosystem VA Reference',
    pathPrefix: `/${ECOSYSTEM_PREFIX}-va-reference`,
    applyPolicy: 'propose',
    apis: REFERENCE_INVENTORY_VERTICAL_APP_SPEC.apis?.map((api) => ({
      ...api,
      path: api.path.replace('/packages/inventory/', `/packages/${ECOSYSTEM_PREFIX}-va-reference/`),
    })),
  };
}

export function vaDesignerLayoutsOnlySpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-designer-only`;
  return {
    packageId,
    name: 'Ecosystem VA Designer Layouts',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'auto',
    designerLayouts: [
      {
        slug: 'welcome',
        title: 'Welcome',
        entry: 'ui/layouts/welcome.js',
      },
    ],
    routes: [{ routePattern: 'welcome', pageKey: 'welcome', nav: { label: 'Welcome', order: 1 } }],
  };
}

export function vaRtlJalaliSpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-rtl`;
  return {
    packageId,
    name: 'Ecosystem VA RTL Jalali',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'auto',
    experienceConfig: {
      locale: 'fa-IR',
      calendar: 'jalali',
      direction: 'rtl',
      timezone: 'Asia/Tehran',
    },
    pages: [{ pageKey: 'home', title: 'Home' }],
  };
}

export function vaExtensionDependencySpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-ext-dep`;
  const extensionId = `${ECOSYSTEM_PREFIX}-pl-dash`;
  return {
    packageId,
    name: 'Ecosystem VA Extension Dep',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'auto',
    dependencies: [{ packageId: extensionId, versionRange: '>=1.0.0' }],
    pages: [{ pageKey: 'home', title: 'Home' }],
  };
}

export function buildStudioExportFullSpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-studio-export`;
  return {
    packageId,
    name: 'Ecosystem Studio Export',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'propose',
    pages: [{ pageKey: 'welcome', title: 'Welcome', entry: 'ui/pages/Welcome.js' }],
    routes: [{ routePattern: 'welcome', pageKey: 'welcome', nav: { label: 'Welcome', order: 1 } }],
    designerLayouts: [
      { slug: 'welcome', title: 'Welcome Layout', entry: 'ui/layouts/welcome.js' },
    ],
    extraFiles: [
      {
        path: 'studio-export-meta.json',
        content: `${JSON.stringify({ schema: 'studio-mount-export-preview', warnings: [] }, null, 2)}\n`,
      },
    ],
  };
}

export function buildStudioExportPartialSpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-studio-partial`;
  return {
    packageId,
    name: 'Ecosystem Studio Partial Export',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'propose',
    designerLayouts: [
      { slug: 'partial', title: 'Partial Layout', entry: 'ui/layouts/partial.js' },
    ],
    routes: [{ routePattern: 'partial', pageKey: 'partial', nav: { label: 'Partial', order: 1 } }],
    extraFiles: [
      {
        path: 'studio-export-meta.json',
        content: `${JSON.stringify({
          schema: 'studio-mount-export-preview',
          warnings: ['Skipped route binding: legacy-page (missing designer draft)'],
          skippedRoutes: ['legacy-page'],
        }, null, 2)}\n`,
      },
    ],
  };
}

/** ST-04 — upload preview parity (Packages page vs Plugins embed · multi-API shape). */
export function buildStudioUploadParitySpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-studio-upload-parity`;
  return {
    packageId,
    name: 'Ecosystem Studio Upload Parity',
    version: '1.0.0',
    apis: [
      {
        id: 'probe-a',
        method: 'GET',
        path: `/packages/${packageId}/probe-a`,
        entry: 'api/probe-a.ts',
        auth: 'public',
      },
      {
        id: 'probe-b',
        method: 'POST',
        path: `/packages/${packageId}/probe-b`,
        entry: 'api/probe-b.ts',
        auth: 'authenticated',
      },
    ],
    extraFiles: [
      {
        path: 'studio-export-meta.json',
        content: `${JSON.stringify({
          schema: 'package-import-preview',
          source: 'upload-parity',
          entrySurfaces: ['packages-page', 'plugins-embed'],
        }, null, 2)}\n`,
      },
    ],
  };
}

/** ST-03 — extension-only export (function export shape). */
export function buildStudioFunctionExportSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-studio-fn-export`;
  return {
    packageId,
    name: 'Ecosystem Studio Function Export',
    version: '1.0.0',
    apis: [
      {
        id: 'echo',
        method: 'GET',
        path: `/packages/${packageId}/echo`,
        entry: 'api/echo.ts',
        auth: 'authenticated',
      },
    ],
    extraFiles: [
      {
        path: 'studio-export-meta.json',
        content: `${JSON.stringify({
          schema: 'package-function-export-preview',
          kind: 'extension',
          source: 'managed-functions',
        }, null, 2)}\n`,
      },
    ],
  };
}

export function plDbSafeSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-pl-db-safe`;
  const objectName = 'eco_db_safe_items';
  return {
    packageId,
    name: 'Ecosystem DB Safe',
    version: '1.0.0',
    dbObjects: [
      {
        objectType: 'table',
        objectName,
        installScript: 'db/install/eco_db_safe_items.sql',
        uninstallScript: 'db/uninstall/eco_db_safe_items.sql',
      },
    ],
  };
}

export function plUiConflictAllowSpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-ui-conflict-allow`;
  return {
    packageId,
    name: 'Ecosystem UI Conflict Allow',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'shared-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/SharedWidgetAllow.js',
      },
    ],
    overridePolicy: {
      apis: 'deny',
      ui_components: 'allow',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function plDbConflictOwnerSpec(objectName = 'eco_shared_table'): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-db-conflict-owner`;
  return {
    packageId,
    name: 'Ecosystem DB Conflict Owner',
    version: '1.0.0',
    dbObjects: [
      {
        objectType: 'table',
        objectName,
        installScript: `db/install/${objectName}.sql`,
        uninstallScript: `db/uninstall/${objectName}.sql`,
      },
    ],
  };
}

export function plDbConflictDenySpec(objectName = 'eco_shared_table'): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-db-conflict-deny`;
  return {
    packageId,
    name: 'Ecosystem DB Conflict Deny',
    version: '1.0.0',
    dbObjects: [
      {
        objectType: 'table',
        objectName,
        installScript: `db/install/${objectName}.sql`,
        uninstallScript: `db/uninstall/${objectName}.sql`,
      },
    ],
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function plUiConflictDenySpec(): PackageZipSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-ui-conflict-deny`;
  return {
    packageId,
    name: 'Ecosystem UI Conflict Deny',
    version: '1.0.0',
    uiComponents: [
      {
        componentKey: 'shared-widget',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/SharedWidgetDeny.js',
      },
    ],
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
  };
}

export function vaProposeInventorySpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-propose`;
  return {
    packageId,
    name: 'Ecosystem VA Propose',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'propose',
  };
}

export function vaAutoMiniSpec(): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-auto-mini`;
  return {
    packageId,
    name: 'Ecosystem VA Auto Mini',
    version: '1.0.0',
    pathPrefix: `/${packageId}`,
    applyPolicy: 'auto',
  };
}

export function vaPathConflictSpec(pathPrefix: string): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-path-conflict`;
  return {
    packageId,
    name: 'Ecosystem VA Path Conflict',
    version: '1.0.0',
    pathPrefix,
    applyPolicy: 'auto',
  };
}

export function vaOwnerForPathConflictSpec(pathPrefix: string): VerticalAppPackageSpec {
  const packageId = `${ECOSYSTEM_PREFIX}-va-owner`;
  return {
    packageId,
    name: 'Ecosystem VA Owner',
    version: '1.0.0',
    pathPrefix,
    applyPolicy: 'auto',
  };
}

export function buildInvalidPluginZip(scenario: 'unknown-key' | 'empty-caps' | 'bad-id' | 'bad-integrity' | 'missing-json' | 'zip-slip' | 'non-zip'): {
  buffer: Buffer;
  originalName: string;
} {
  const zip = new AdmZip();
  const packageId = `${ECOSYSTEM_PREFIX}-invalid`;

  switch (scenario) {
    case 'missing-json':
      zip.addFile('api/orphan.js', Buffer.from('export default () => ({});\n', 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'missing-json.zip' };

    case 'zip-slip':
      zip.addFile('package.json', Buffer.from('{"$schemaVersion":"1.0"}\n', 'utf8'));
      zip.addFile('../escape.txt', Buffer.from('unsafe\n', 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'zip-slip.zip' };

    case 'non-zip': {
      const valid = buildPackageZipBuffer(plApiOnlySpec('nonzip'));
      return { buffer: valid, originalName: 'artifact.bin' };
    }

    case 'unknown-key': {
      const manifest = {
        $schemaVersion: '1.0',
        id: `${packageId}-unknown`,
        name: 'Unknown Key',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        unexpected: true,
        dependencies: [],
        capabilities: {
          apis: [
            {
              id: 'x',
              method: 'GET',
              path: `/packages/${packageId}-unknown/x`,
              entry: 'api/x.js',
            },
          ],
          ui_components: [],
          db_objects: [],
        },
        overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
        integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
      };
      zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
      zip.addFile('api/x.js', Buffer.from('export default () => ({});\n', 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'unknown-key.zip' };
    }

    case 'empty-caps': {
      const manifest = {
        $schemaVersion: '1.0',
        id: `${packageId}-empty`,
        name: 'Empty Caps',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        dependencies: [],
        capabilities: { apis: [], ui_components: [], db_objects: [] },
        overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
        integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
      };
      zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'empty-caps.zip' };
    }

    case 'bad-id': {
      const manifest = {
        $schemaVersion: '1.0',
        id: '1badid',
        name: 'Bad Id',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        dependencies: [],
        capabilities: {
          apis: [{ id: 'x', method: 'GET', path: '/packages/bad/x', entry: 'api/x.js' }],
          ui_components: [],
          db_objects: [],
        },
        overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
        integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
      };
      zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
      zip.addFile('api/x.js', Buffer.from('export default () => ({});\n', 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'bad-id.zip' };
    }

    case 'bad-integrity': {
      const manifest = {
        $schemaVersion: '1.0',
        id: `${packageId}-hash`,
        name: 'Bad Hash',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        dependencies: [],
        capabilities: {
          apis: [{ id: 'x', method: 'GET', path: `/packages/${packageId}-hash/x`, entry: 'api/x.js' }],
          ui_components: [],
          db_objects: [],
        },
        overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
        integrity: { algorithm: 'sha256', artifactHash: 'bad-hash' },
      };
      zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
      zip.addFile('api/x.js', Buffer.from('export default () => ({});\n', 'utf8'));
      return { buffer: zip.toBuffer(), originalName: 'bad-integrity.zip' };
    }

    default:
      throw new Error(`Unknown invalid package scenario: ${scenario}`);
  }
}

export function buildInvalidVerticalAppZip(
  scenario: 'unknown-key' | 'bad-kind' | 'zip-slip' | 'bad-integrity',
): { buffer: Buffer; originalName: string } {
  const zip = new AdmZip();
  const packageId = `${ECOSYSTEM_PREFIX}-va-invalid`;

  if (scenario === 'zip-slip') {
    zip.addFile('package.json', Buffer.from('{"$schemaVersion":"1.1"}\n', 'utf8'));
    zip.addFile('../escape.txt', Buffer.from('unsafe\n', 'utf8'));
    return { buffer: zip.toBuffer(), originalName: 'va-zip-slip.zip' };
  }

  if (scenario === 'bad-integrity') {
    const manifest = {
      $schemaVersion: '1.1',
      kind: 'vertical-app',
      id: packageId,
      name: 'Invalid VA Hash',
      version: '1.0.0',
      requiredAppVersion: '>=1.0.0',
      dependencies: [],
      capabilities: {
        shell: {
          key: `${packageId}-shell`,
          name: 'Shell',
          entry: 'ui/shell/AppShell.js',
          surface: 'portal',
        },
        pages: [{ pageKey: 'home', title: 'Home', entry: 'ui/pages/Home.js' }],
        apis: [],
        db_objects: [],
        mcp_servers: [],
      },
      deployment: {
        applyPolicy: 'auto',
        mount: {
          id: packageId,
          pathPrefix: `/${packageId}`,
          name: 'Invalid VA Hash',
          defaultRoute: 'home',
          authProfile: { requireAuth: true },
        },
        shellRule: { pathPrefix: `/${packageId}`, shellKey: `${packageId}-shell`, priority: 10 },
        routes: [{ routePattern: 'home', pageKey: 'home', nav: { label: 'Home', order: 1 } }],
      },
      overridePolicy: { apis: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
      integrity: { algorithm: 'sha256', artifactHash: 'bad-hash' },
    };
    zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
    zip.addFile('ui/shell/AppShell.js', Buffer.from('export default () => ({});\n', 'utf8'));
    zip.addFile('ui/pages/Home.js', Buffer.from('export default () => ({});\n', 'utf8'));
    return { buffer: zip.toBuffer(), originalName: 'va-bad-integrity.zip' };
  }

  const baseManifest: Record<string, unknown> = {
    $schemaVersion: '1.1',
    kind: scenario === 'bad-kind' ? 'extension' : 'vertical-app',
    id: packageId,
    name: 'Invalid VA',
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      shell: {
        key: `${packageId}-shell`,
        name: 'Shell',
        entry: 'ui/shell/AppShell.js',
        surface: 'portal',
      },
      pages: [{ pageKey: 'home', title: 'Home', entry: 'ui/pages/Home.js' }],
      apis: [],
      db_objects: [],
      mcp_servers: [],
    },
    deployment: {
      applyPolicy: 'auto',
      mount: {
        id: packageId,
        pathPrefix: `/${packageId}`,
        name: 'Invalid VA',
        defaultRoute: 'home',
        authProfile: { requireAuth: true },
      },
      shellRule: { pathPrefix: `/${packageId}`, shellKey: `${packageId}-shell`, priority: 10 },
      routes: [{ routePattern: 'home', pageKey: 'home', nav: { label: 'Home', order: 1 } }],
    },
    overridePolicy: { apis: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
  };

  if (scenario === 'unknown-key') {
    baseManifest.unexpected = true;
  }

  zip.addFile('package.json', Buffer.from(`${JSON.stringify(baseManifest, null, 2)}\n`, 'utf8'));
  zip.addFile('ui/shell/AppShell.js', Buffer.from('export default () => ({});\n', 'utf8'));
  zip.addFile('ui/pages/Home.js', Buffer.from('export default () => ({});\n', 'utf8'));
  return { buffer: zip.toBuffer(), originalName: `${scenario}.zip` };
}

export {
  buildPackageZipBuffer,
  buildVerticalAppZipBuffer,
};
