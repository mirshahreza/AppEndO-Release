import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type {
  VerticalAppDeploymentMount,
  VerticalAppDeploymentRoute,
  VerticalAppManifest,
} from '../../../shared/api/contracts/package-manifest/verticalApp';

export type VerticalAppPageSpec = {
  pageKey: string;
  title: string;
  entry?: string;
};

export type VerticalAppRouteSpec = {
  routePattern: string;
  pageKey: string;
  nav?: VerticalAppDeploymentRoute['nav'];
};

export type VerticalAppDesignerLayoutSpec = {
  slug: string;
  title: string;
  entry?: string;
};

export type VerticalAppPackageSpec = {
  packageId: string;
  name: string;
  version: string;
  pathPrefix: string;
  description?: string;
  createdBy?: string;
  mountId?: string;
  applyPolicy?: 'propose' | 'auto';
  defaultRoute?: string;
  dependencies?: VerticalAppManifest['dependencies'];
  experienceConfig?: VerticalAppDeploymentMount['experienceConfig'];
  branding?: VerticalAppManifest['branding'];
  pages?: VerticalAppPageSpec[];
  designerLayouts?: VerticalAppDesignerLayoutSpec[];
  routes?: VerticalAppRouteSpec[];
  apis?: VerticalAppManifest['capabilities']['apis'];
  dbObjects?: VerticalAppManifest['capabilities']['db_objects'];
  staticAssets?: VerticalAppManifest['capabilities']['static_assets'];
  extraFiles?: Array<{ path: string; content: string | Buffer }>;
};

type ZipEntry = { path: string; content: Buffer };

const PLACEHOLDER_HASH = '0'.repeat(64);

const INVENTORY_DB_INSTALL = `-- Reference inventory items table (p-14)
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const INVENTORY_DB_UNINSTALL = `-- Reference inventory items table (p-14)
DROP TABLE IF EXISTS inventory_items;
`;

const INVENTORY_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Inventory">
  <rect width="64" height="64" rx="12" fill="#4f46e5"/>
  <path d="M16 22h32v6H16zm0 10h20v6H16zm0 10h28v6H16z" fill="#fff"/>
</svg>
`;

export const REFERENCE_INVENTORY_VERTICAL_APP_SPEC: VerticalAppPackageSpec = {
  packageId: 'inventory',
  name: 'Reference Inventory',
  version: '1.0.0',
  pathPrefix: '/inventory',
  description: 'Production-ready reference vertical-app for stock tracking (p-14 quality gate).',
  createdBy: 'AppEndO',
  applyPolicy: 'propose',
  defaultRoute: 'dashboard',
  experienceConfig: {
    locale: 'en',
    calendar: 'gregorian',
    direction: 'ltr',
    timezone: 'UTC',
  },
  branding: {
    logoAssetKey: 'logo',
  },
  pages: [
    { pageKey: 'dashboard', title: 'Dashboard', entry: 'ui/pages/Dashboard.js' },
    { pageKey: 'items', title: 'Items', entry: 'ui/pages/Items.js' },
  ],
  routes: [
    { routePattern: 'dashboard', pageKey: 'dashboard', nav: { label: 'Dashboard', order: 1 } },
    { routePattern: 'items', pageKey: 'items', nav: { label: 'Items', order: 2 } },
  ],
  apis: [
    {
      id: 'inventory.health',
      method: 'GET',
      path: '/packages/inventory/health',
      entry: 'api/health.js',
      auth: 'public',
    },
    {
      id: 'inventory.items.list',
      method: 'GET',
      path: '/packages/inventory/items',
      entry: 'api/items.js',
      auth: 'authenticated',
    },
  ],
  dbObjects: [
    {
      objectType: 'table',
      objectName: 'inventory_items',
      installScript: 'db/install/inventory_items.sql',
      uninstallScript: 'db/uninstall/inventory_items.sql',
    },
  ],
  staticAssets: [
    {
      assetKey: 'logo',
      path: 'assets/logo.svg',
      mime: 'image/svg+xml',
      public: true,
    },
  ],
  extraFiles: [
    {
      path: 'db/install/inventory_items.sql',
      content: INVENTORY_DB_INSTALL,
    },
    {
      path: 'db/uninstall/inventory_items.sql',
      content: INVENTORY_DB_UNINSTALL,
    },
    {
      path: 'assets/logo.svg',
      content: INVENTORY_LOGO_SVG,
    },
    {
      path: 'api/health.js',
      content: `module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: 'inventory', status: 'ok' });
};
`,
    },
    {
      path: 'api/items.js',
      content: `module.exports = async function handler(_req, res) {
  return res.json({
    success: true,
    data: [],
    count: 0,
    source: 'inventory',
  });
};
`,
    },
    {
      path: 'ui/pages/Dashboard.js',
      content: `export default function DashboardPage() {
  return {
    type: 'div',
    props: { 'data-page': 'dashboard', 'data-package': 'inventory' },
    children: 'Inventory dashboard',
  };
}
`,
    },
    {
      path: 'ui/pages/Items.js',
      content: `export default function ItemsPage() {
  return {
    type: 'div',
    props: { 'data-page': 'items', 'data-package': 'inventory' },
    children: 'Inventory items',
  };
}
`,
    },
    {
      path: 'ui/shell/AppShell.js',
      content: `export default function inventoryShell() {
  return {
    type: 'div',
    props: { 'data-shell': 'inventory', 'data-surface': 'portal' },
    children: 'Inventory portal shell',
  };
}
`,
    },
  ],
};

function shellEntrySource(packageId: string): string {
  return `export default function ${packageId.replace(/-/g, '_')}Shell() {
  return { type: 'div', props: { 'data-shell': '${packageId}' }, children: 'Shell' };
}
`;
}

function pageEntrySource(pageKey: string, packageId: string): string {
  const safeName = pageKey.replace(/[^A-Za-z0-9_]/g, '_');
  return `export default function ${safeName}Page() {
  return { type: 'div', props: { 'data-page': '${pageKey}', 'data-package': '${packageId}' }, children: 'Page' };
}
`;
}

function defaultApiEntrySource(packageId: string): string {
  return `module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: '${packageId}' });
};
`;
}

function designerLayoutEntrySource(slug: string, packageId: string): string {
  const safeName = slug.replace(/[^A-Za-z0-9_]/g, '_');
  return `export default function ${safeName}Layout() {
  return { type: 'div', props: { 'data-layout': '${slug}', 'data-package': '${packageId}' }, children: 'Layout' };
}
`;
}

function resolveDesignerLayouts(spec: VerticalAppPackageSpec): Array<Required<VerticalAppDesignerLayoutSpec>> {
  return (spec.designerLayouts ?? []).map((layout) => ({
    ...layout,
    entry: layout.entry ?? `ui/layouts/${layout.slug}.js`,
  }));
}

function resolvePages(spec: VerticalAppPackageSpec): VerticalAppPageSpec[] {
  if (spec.pages && spec.pages.length > 0) {
    return spec.pages.map((page) => ({
      ...page,
      entry: page.entry ?? `ui/pages/${page.pageKey.replace(/-/g, '_')}.js`,
    }));
  }

  if (spec.designerLayouts && spec.designerLayouts.length > 0) {
    return [];
  }

  return [{ pageKey: 'home', title: 'Home', entry: 'ui/pages/Home.js' }];
}

function resolveRoutes(
  spec: VerticalAppPackageSpec,
  pages: VerticalAppPageSpec[],
  designerLayouts: Array<Required<VerticalAppDesignerLayoutSpec>>,
): VerticalAppRouteSpec[] {
  if (spec.routes && spec.routes.length > 0) {
    return spec.routes;
  }

  if (pages.length > 0) {
    const pageKey = pages[0]?.pageKey ?? 'home';
    return [{ routePattern: pageKey, pageKey, nav: { label: 'Home', order: 1 } }];
  }

  const slug = designerLayouts[0]?.slug ?? 'home';
  return [{ routePattern: slug, pageKey: slug, nav: { label: designerLayouts[0]?.title ?? 'Home', order: 1 } }];
}

function computeArtifactHash(entries: ZipEntry[]): string {
  const payload = entries
    .filter((entry) => entry.path !== 'package.json')
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}\0${entry.content.toString('base64')}`)
    .join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function extraFileMap(spec: VerticalAppPackageSpec): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  for (const file of spec.extraFiles ?? []) {
    map.set(file.path, Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8'));
  }
  return map;
}

export function buildVerticalAppManifest(
  spec: VerticalAppPackageSpec,
  artifactHash = PLACEHOLDER_HASH,
): VerticalAppManifest {
  const mountId = spec.mountId ?? spec.packageId;
  const pages = resolvePages(spec);
  const designerLayouts = resolveDesignerLayouts(spec);
  const routes = resolveRoutes(spec, pages, designerLayouts);
  const defaultRoute = spec.defaultRoute ?? pages[0]?.pageKey ?? designerLayouts[0]?.slug ?? 'home';
  const shellKey = `${spec.packageId}-shell`;

  return {
    $schemaVersion: '1.1',
    kind: 'vertical-app',
    id: spec.packageId,
    name: spec.name,
    version: spec.version,
    description: spec.description,
    createdBy: spec.createdBy,
    requiredAppVersion: '>=1.0.0',
    dependencies: spec.dependencies ?? [],
    branding: spec.branding,
    capabilities: {
      shell: {
        key: shellKey,
        name: `${spec.name} Shell`,
        entry: 'ui/shell/AppShell.js',
        surface: 'portal',
      },
      pages: pages.map((page) => ({
        pageKey: page.pageKey,
        title: page.title,
        entry: page.entry!,
      })),
      designer_layouts: designerLayouts.length > 0
        ? designerLayouts.map((layout) => ({
            slug: layout.slug,
            title: layout.title,
            entry: layout.entry,
          }))
        : undefined,
      static_assets: spec.staticAssets,
      apis: spec.apis ?? [],
      db_objects: spec.dbObjects ?? [],
      mcp_servers: [],
    },
    deployment: {
      applyPolicy: spec.applyPolicy ?? 'propose',
      mount: {
        id: mountId,
        pathPrefix: spec.pathPrefix,
        name: spec.name,
        defaultRoute,
        authProfile: { requireAuth: true },
        experienceConfig: spec.experienceConfig,
      },
      shellRule: {
        pathPrefix: spec.pathPrefix,
        shellKey,
        priority: 10,
      },
      routes,
    },
    overridePolicy: {
      apis: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash,
    },
  };
}

export function buildVerticalAppZipBuffer(spec: VerticalAppPackageSpec): Buffer {
  const overrides = extraFileMap(spec);
  const manifestWithoutHash = buildVerticalAppManifest(spec, PLACEHOLDER_HASH);
  const entries: ZipEntry[] = [];

  const shellPath = manifestWithoutHash.capabilities.shell.entry;
  entries.push({
    path: shellPath,
    content: overrides.get(shellPath) ?? Buffer.from(shellEntrySource(spec.packageId), 'utf8'),
  });

  for (const page of manifestWithoutHash.capabilities.pages ?? []) {
    entries.push({
      path: page.entry,
      content: overrides.get(page.entry) ?? Buffer.from(pageEntrySource(page.pageKey, spec.packageId), 'utf8'),
    });
  }

  for (const layout of manifestWithoutHash.capabilities.designer_layouts ?? []) {
    entries.push({
      path: layout.entry,
      content: overrides.get(layout.entry) ?? Buffer.from(designerLayoutEntrySource(layout.slug, spec.packageId), 'utf8'),
    });
  }

  for (const api of manifestWithoutHash.capabilities.apis) {
    entries.push({
      path: api.entry,
      content: overrides.get(api.entry) ?? Buffer.from(defaultApiEntrySource(spec.packageId), 'utf8'),
    });
  }

  for (const db of manifestWithoutHash.capabilities.db_objects) {
    entries.push({
      path: db.installScript,
      content:
        overrides.get(db.installScript)
        ?? Buffer.from(`-- install ${db.objectName}\nSELECT 1;\n`, 'utf8'),
    });
    if (db.uninstallScript) {
      entries.push({
        path: db.uninstallScript,
        content:
          overrides.get(db.uninstallScript)
          ?? Buffer.from(`-- uninstall ${db.objectName}\nSELECT 1;\n`, 'utf8'),
      });
    }
  }

  for (const asset of manifestWithoutHash.capabilities.static_assets ?? []) {
    entries.push({
      path: asset.path,
      content: overrides.get(asset.path) ?? Buffer.from(`asset:${asset.assetKey}`, 'utf8'),
    });
  }

  for (const [path, content] of overrides.entries()) {
    if (!entries.some((entry) => entry.path === path)) {
      entries.push({ path, content });
    }
  }

  const artifactHash = computeArtifactHash(entries);
  const manifest = buildVerticalAppManifest(spec, artifactHash);

  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.path, entry.content);
  }
  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  return zip.toBuffer();
}
