import fs from 'node:fs';
import path from 'node:path';
import { writeCursorFeatureRules } from './cursorRuleCodegen';
import { writeHawietyCursorPageLockRules, writePageEditLockManifest } from './operatorPageEditLockCodegen';

type StudioNavItem = {
  pageKey: string;
  routePattern: string;
  label: string;
  menuGroup: string | null;
};

type PageModuleRecord = {
  pageKey: string;
  loaderRef: string;
  defaultRoles: string[];
  enabled: boolean;
};

export type FeatureGraphNode = {
  pageKey: string;
  label: string;
  menuGroup: string | null;
  routePattern: string;
  inStudioMenu: boolean;
  ui: {
    pageModule: string | null;
    loaderRef: string;
    page: string | null;
    feature: string | null;
    domain: string | null;
    workspace: string | null;
  };
  api: {
    routes: string[];
    apiPrefixes: string[];
    contracts: string | null;
    services: string[];
  };
  tests: string | null;
  notes: string | null;
};

export type FeatureGraph = {
  version: string;
  generatedAt: string;
  source: {
    navigation: string;
    pageModulesDir: string;
  };
  nodes: FeatureGraphNode[];
};

export const PAGE_KEY_TO_FEATURE: Record<string, string> = {
  dashboard: 'dashboard',
  'server-functions': 'server-functions',
  'client-components': 'component-designer',
  'platform-portals': 'platform-portals',
  'platform-navigations': 'platform-navigations',
  'package-manager': 'packages',
  libraries: 'libraries',
  'base-components': 'base-components',
  'dev-reference': 'dev-reference',
  settings: 'settings',
  'platform-transfer': 'platform-transfer',
  'scheduled-tasks': 'scheduled-tasks',
  jobs: 'jobs',
  workflows: 'workflows',
  cache: 'cache',
  git: 'git',
  'ssh-hub': 'ssh-hub',
  'rdp-hub': 'rdp-hub',
  'file-hub': 'file-hub',
  'file-manager': 'file-manager',
  sources: 'data-sources',
  'data-studio': 'data-studio',
  users: 'users',
  roles: 'roles',
  'chat-history': 'chat-history',
  'base-info': 'base-info',
  'organization-chart': 'org-geo',
  'geographic-divisions': 'org-geo',
  logs: 'logs',
  'my-apis': 'my-apis',
  'base-components-dialog': 'base-components',
  'sql-console': 'sql-console',
  workbooks: 'workbooks',
  'my-workbooks': 'workbooks',
  'idea-foundry': 'idea-foundry',
  'api-talk': 'api-talk',
};

const LOADER_REF_TO_PAGE: Record<string, string> = {};

/** Page entries colocated in feature folders (TOK-5 migration). */
const LOADER_REF_TO_FEATURE_PAGE: Record<string, string> = {
  'core:Dashboard': 'src/features/dashboard/DashboardPage.tsx',
  'core:Users': 'src/features/users/UsersPage.tsx',
  'core:Roles': 'src/features/roles/RolesPage.tsx',
  'core:ComponentDesigner': 'src/features/component-designer/ComponentDesignerPage.tsx',
  'core:PackageManager': 'src/features/packages/PackageManagerPage.tsx',
  'core:Libraries': 'src/features/libraries/LibrariesPage.tsx',
  'core:BaseComponents': 'src/features/base-components/BaseComponentsPage.tsx',
  'core:Appearance': 'src/features/appearance/AppearancePage.tsx',
  'core:DevReference': 'src/features/dev-reference/DevReferencePage.tsx',
  'core:Settings': 'src/features/settings/SettingsPage.tsx',
  'core:ServerFunctions': 'src/features/server-functions/ServerFunctionsPage.tsx',
  'core:DataStudio': 'src/features/data-studio/DataStudioPage.tsx',
  'core:DataSources': 'src/features/data-sources/DataSourcesPage.tsx',
  'core:Cache': 'src/features/cache/CachePage.tsx',
  'core:Git': 'src/features/git/GitPage.tsx',
  'core:FileManager': 'src/features/file-manager/FileManagerPage.tsx',
  'core:Logs': 'src/features/logs/LogsPage.tsx',
  'core:Jobs': 'src/features/jobs/JobsPage.tsx',
  'core:Workflows': 'src/features/workflows/WorkflowsPage.tsx',
  'core:ScheduledTasks': 'src/features/scheduled-tasks/ScheduledTasksPage.tsx',
  'core:BaseInfo': 'src/features/base-info/BaseInfoPage.tsx',
  'core:OrganizationChart': 'src/features/org-geo/OrganizationChartPage.tsx',
  'core:GeographicDivisions': 'src/features/org-geo/GeographicDivisionsPage.tsx',
  'core:ChatHistory': 'src/features/chat-history/ChatHistoryPage.tsx',
  'core:InAppNotifications': 'src/features/in-app-notifications/InAppNotificationsPage.tsx',
  'core:MyApis': 'src/features/my-apis/MyApisPage.tsx',
  'core:PlatformPortals': 'src/features/platform-portals/PlatformPortalsPage.tsx',
  'core:PlatformNavigations': 'src/features/platform-navigations/PlatformNavigationsPage.tsx',
  'core:PlatformTransfer': 'src/features/platform-transfer/PlatformTransferPage.tsx',
  'core:SqlConsole': 'src/features/sql-console/SqlConsolePage.tsx',
  'core:Workbooks': 'src/features/workbooks/WorkbooksPage.tsx',
  'core:MyWorkbooks': 'src/features/workbooks/MyWorkbooksPage.tsx',
  'core:IdeaFoundry': 'src/features/idea-foundry/IdeaFoundryPage.tsx',
  'core:ApiTalk': 'src/features/api-talk/ApiTalkPage.tsx',
  'hawiety:hwy-member-dossier': 'src/features/hwy-member-dossier/HwyMemberDossierPage.tsx',
  'hawiety:hwy-member-dossier-view': 'src/features/hwy-member-dossier/HwyMemberDossierViewPage.tsx',
  'hawiety:hwy-member-dossier-edit': 'src/features/hwy-member-dossier/HwyMemberDossierEditPage.tsx',
  'hawiety:hwy-org-membership-transfer': 'src/features/hwy-org-membership-transfer/HwyOrgMembershipTransferPage.tsx',
  'hawiety:hwy-geo-responsibility': 'src/features/hwy-geo-responsibility/HwyGeoResponsibilityPage.tsx',
  'hawiety:hwy-etl-console': 'src/features/hwy-etl-console/HwyEtlConsolePage.tsx',
  'hawiety:hwy-business-rules-reference': 'src/features/hwy-business-rules-reference/HwyBusinessRulesReferencePage.tsx',
};

type PageApiEntry = {
  routes: string[];
  apiPrefixes: string[];
  contracts?: string;
  services?: string[];
  notes?: string;
};

const PAGE_API_MAP: Record<string, PageApiEntry> = {
  dashboard: {
    routes: ['src/server/routes/dashboard.routes.ts'],
    apiPrefixes: ['/api/dashboard'],
  },
  'server-functions': {
    routes: ['src/server/routes/server-functions.routes.ts', 'src/server/routes/functions.routes.ts'],
    apiPrefixes: ['/api/core/server-functions', '/api/functions'],
    contracts: 'src/shared/api/contracts/server-functions/',
    services: ['src/server/services/functions.service.ts'],
  },
  'client-components': {
    routes: ['src/server/routes/component-designer.routes.ts'],
    apiPrefixes: ['/api/component-designer'],
    contracts: 'src/shared/api/contracts/component-designer/',
    services: ['src/server/services/component-designer.service.ts'],
  },
  'platform-portals': {
    routes: ['src/server/routes/platform.routes.ts'],
    apiPrefixes: ['/api/platform'],
    contracts: 'src/shared/api/contracts/platform/',
    services: ['src/server/services/platform/'],
  },
  'platform-navigations': {
    routes: ['src/server/routes/platform.routes.ts'],
    apiPrefixes: ['/api/platform/navigations'],
    contracts: 'src/shared/api/contracts/platform/navigation.ts',
    services: ['src/server/services/platform/navigationManifest.service.ts'],
  },
  'package-manager': {
    routes: ['src/server/routes/packages.routes.ts', 'src/server/routes/package.routes.ts'],
    apiPrefixes: ['/api/packages', '/api/package'],
    contracts: 'src/shared/api/contracts/package/',
    services: ['src/server/services/package/', 'src/server/services/package-runtime/'],
  },
  libraries: {
    routes: ['src/server/routes/libraries.routes.ts'],
    apiPrefixes: ['/api/libraries'],
    contracts: 'src/shared/api/contracts/libraries/',
    services: ['src/server/services/libraries/'],
  },
  sandbox: {
    routes: [],
    apiPrefixes: [],
    notes: 'In-app UI standards preview — no dedicated REST surface',
  },
  settings: {
    routes: [
      'src/server/routes/settings.routes.ts',
      'src/server/routes/settings-attributes.routes.ts',
      'src/server/routes/ai.routes.ts',
      'src/server/routes/mcp.routes.ts',
    ],
    apiPrefixes: ['/api/settings', '/api/ai', '/api/mcp'],
    contracts: 'src/shared/api/contracts/settings/',
    services: ['src/server/services/settings/', 'src/server/services/ai/'],
  },
  'scheduled-tasks': {
    routes: ['src/server/routes/scheduler.routes.ts'],
    apiPrefixes: ['/api/scheduler'],
    contracts: 'src/shared/api/contracts/scheduler/',
  },
  jobs: {
    routes: ['src/server/routes/jobs.routes.ts'],
    apiPrefixes: ['/api/jobs'],
    contracts: 'src/shared/api/contracts/jobs/',
  },
  workflows: {
    routes: ['src/server/routes/workflows.routes.ts'],
    apiPrefixes: ['/api/workflows'],
    services: ['src/server/domain/workflow/designer/'],
  },
  cache: {
    routes: ['src/server/routes/cache.routes.ts'],
    apiPrefixes: ['/api/cache'],
    contracts: 'src/shared/api/contracts/cache/',
  },
  git: {
    routes: ['src/server/routes/git.routes.ts'],
    apiPrefixes: ['/api/git'],
    contracts: 'src/shared/api/contracts/git/',
    services: ['src/server/services/git/'],
  },
  'ssh-hub': {
    routes: ['src/server/routes/ssh-hub.routes.ts'],
    apiPrefixes: ['/api/ssh-hub'],
    contracts: 'src/shared/api/contracts/ssh-hub/',
    services: ['src/server/services/ssh-hub/'],
  },
  'rdp-hub': {
    routes: ['src/server/routes/rdp-hub.routes.ts'],
    apiPrefixes: ['/api/rdp-hub'],
    contracts: 'src/shared/api/contracts/rdp-hub/',
    services: ['src/server/services/rdp-hub/'],
  },
  'file-hub': {
    routes: ['src/server/routes/file-hub.routes.ts'],
    apiPrefixes: ['/api/file-hub'],
    contracts: 'src/shared/api/contracts/file-hub/',
    services: ['src/server/services/file-hub/'],
  },
  'file-manager': {
    routes: ['src/server/routes/file-manager.routes.ts'],
    apiPrefixes: ['/api/file-manager'],
    contracts: 'src/shared/api/contracts/file-manager/',
    services: ['src/server/services/file-manager.service.ts'],
  },
  'data-studio': {
    routes: [
      'src/server/routes/data-api.routes.ts',
      'src/server/routes/data-sources.routes.ts',
      'src/server/routes/data-source-schema.routes.ts',
    ],
    apiPrefixes: ['/api/data-api', '/api/data-sources'],
    contracts: 'src/shared/api/contracts/data-sources/',
    services: ['src/server/services/data-api/'],
    notes: 'Schema explorer and EdgeModel APIs; connection create/edit UI also in Data Sources page',
  },
  sources: {
    routes: [
      'src/server/routes/data-sources.routes.ts',
      'src/server/routes/data-source-schema.routes.ts',
      'src/server/routes/db-enrichment.routes.ts',
    ],
    apiPrefixes: ['/api/data-sources', '/api/db-enrichment'],
    contracts: 'src/shared/api/contracts/data-sources/',
  },
  'sql-console': {
    routes: ['src/server/routes/sql-console.routes.ts'],
    apiPrefixes: ['/api/sql-console'],
    services: ['src/server/services/sql-console/'],
  },
  workbooks: {
    routes: ['src/server/routes/workbooks.routes.ts'],
    apiPrefixes: ['/api/workbooks'],
    contracts: 'src/shared/api/contracts/workbooks/',
    services: ['src/server/services/workbooks/'],
  },
  'my-workbooks': {
    routes: ['src/server/routes/workbooks.routes.ts'],
    apiPrefixes: ['/api/workbooks'],
    contracts: 'src/shared/api/contracts/workbooks/',
    services: ['src/server/services/workbooks/'],
  },
  'idea-foundry': {
    routes: ['src/server/routes/idea-foundry.routes.ts'],
    apiPrefixes: ['/api/idea-foundry'],
    contracts: 'src/shared/api/contracts/idea-foundry/',
    services: ['src/server/services/idea-foundry/'],
  },
  'api-talk': {
    routes: ['src/server/routes/api-talk.routes.ts'],
    apiPrefixes: ['/api/api-talk'],
    services: ['src/server/services/http-connections/collectionsStore.ts'],
  },
  users: {
    routes: ['src/server/routes/users.routes.ts', 'src/server/routes/profile.routes.ts'],
    apiPrefixes: ['/api/users', '/api/profile'],
    contracts: 'src/shared/api/contracts/users/',
    services: ['src/server/services/users/'],
  },
  roles: {
    routes: ['src/server/routes/users.routes.ts'],
    apiPrefixes: ['/api/roles'],
    contracts: 'src/shared/api/contracts/roles/',
  },
  'chat-history': {
    routes: ['src/server/routes/ai.routes.ts'],
    apiPrefixes: ['/api/ai'],
    contracts: 'src/shared/api/contracts/ai/',
    notes: 'Chat history UI — AI session APIs',
  },
  'base-info': {
    routes: ['src/server/routes/base-info.routes.ts'],
    apiPrefixes: ['/api/base-info'],
    contracts: 'src/shared/api/contracts/base-info/',
  },
  'organization-chart': {
    routes: ['src/server/routes/base-info.routes.ts'],
    apiPrefixes: ['/api/base-info'],
    contracts: 'src/shared/api/contracts/org-geo/',
    notes: 'Scoped Organization tree UI over base_info root 100.4 (under Base)',
  },
  'geographic-divisions': {
    routes: ['src/server/routes/base-info.routes.ts'],
    apiPrefixes: ['/api/base-info'],
    contracts: 'src/shared/api/contracts/org-geo/',
    notes: 'Scoped Geographic Divisions tree UI over base_info root 100.5 (under Base)',
  },
  logs: {
    routes: ['src/server/routes/logs.routes.ts'],
    apiPrefixes: ['/api/logs'],
    contracts: 'src/shared/api/contracts/logs/',
    services: ['src/server/services/logs.service.ts'],
  },
  'my-apis': {
    routes: ['src/server/routes/docs.routes.ts'],
    apiPrefixes: ['/api/docs'],
    contracts: 'src/shared/api/contracts/my-apis/',
    notes: 'Hidden from studio menu — opened from Profile drawer',
  },
  'sandbox-dialog': {
    routes: [],
    apiPrefixes: [],
    notes: 'Modal route for sandbox dialogs',
  },
};

type OrphanFeatureEntry = {
  pageKey: string;
  label: string;
  featureFolder: string;
  api?: PageApiEntry;
  notes: string;
};

/** Features with code on disk but no studio.json / page-module registry entry. */
const ORPHAN_FEATURES: OrphanFeatureEntry[] = [];

function parseStudioNavigation(navigationJson: {
  groups: Array<{
    heading: string | null;
    items: Array<{
      pageKey: string;
      routePattern: string;
      label: string;
    }>;
  }>;
}): StudioNavItem[] {
  const items: StudioNavItem[] = [];
  for (const group of navigationJson.groups) {
    for (const item of group.items) {
      items.push({
        pageKey: item.pageKey,
        routePattern: item.routePattern,
        label: item.label,
        menuGroup: group.heading,
      });
    }
  }
  return items;
}

function readPageModules(pageModulesDir: string): PageModuleRecord[] {
  const files = fs.readdirSync(pageModulesDir).filter((name) => name.endsWith('.json'));
  return files.map((file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(pageModulesDir, file), 'utf8')) as PageModuleRecord;
    return raw;
  });
}

function pathExists(rootDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function detectWorkspace(rootDir: string, featureDir: string | null): string | null {
  if (!featureDir) return null;
  const componentsDir = path.join(rootDir, featureDir, 'components');
  if (!fs.existsSync(componentsDir)) return null;
  const files = fs.readdirSync(componentsDir);
  const workspace = files.find((name) => name.endsWith('Workspace.tsx'));
  if (workspace) return workspace.replace(/\.tsx$/, '');
  const pageView = files.find((name) => name.endsWith('PageView.tsx'));
  return pageView ? pageView.replace(/\.tsx$/, '') : null;
}

function resolvePagePath(rootDir: string, loaderRef: string): string | null {
  const featurePage = LOADER_REF_TO_FEATURE_PAGE[loaderRef];
  if (featurePage && pathExists(rootDir, featurePage)) return featurePage;

  const pageName = LOADER_REF_TO_PAGE[loaderRef];
  if (!pageName) return null;
  const relative = `src/pages/${pageName}.tsx`;
  return pathExists(rootDir, relative) ? relative : null;
}

function buildNode(
  rootDir: string,
  pageKey: string,
  nav: StudioNavItem | undefined,
  module: PageModuleRecord | undefined,
): FeatureGraphNode {
  const featureFolder = PAGE_KEY_TO_FEATURE[pageKey] ?? pageKey;
  const featurePath = `src/features/${featureFolder}/`;
  const featureExists = pathExists(rootDir, featurePath);
  const domainPath = pageKey === 'client-components' ? 'src/domain/component-designer/' : null;
  const api = PAGE_API_MAP[pageKey] ?? { routes: [], apiPrefixes: [] };
  const loaderRef = module?.loaderRef ?? 'unknown';
  const testsPath = featureExists ? `${featurePath}__tests__/` : null;

  return {
    pageKey,
    label: nav?.label ?? module?.pageKey ?? pageKey,
    menuGroup: nav?.menuGroup ?? null,
    routePattern: nav?.routePattern ?? pageKey,
    inStudioMenu: Boolean(nav),
    ui: {
      pageModule: `src/config/platform-registry/page-modules/${pageKey}.json`,
      loaderRef,
      page: resolvePagePath(rootDir, loaderRef),
      feature: featureExists ? featurePath : null,
      domain: domainPath && pathExists(rootDir, domainPath) ? domainPath : null,
      workspace: detectWorkspace(rootDir, featureExists ? featurePath : null),
    },
    api: {
      routes: api.routes,
      apiPrefixes: api.apiPrefixes,
      contracts: api.contracts && pathExists(rootDir, api.contracts) ? api.contracts : api.contracts ?? null,
      services: (api.services ?? []).filter((entry) => pathExists(rootDir, entry)),
    },
    tests: testsPath && pathExists(rootDir, testsPath) ? testsPath : null,
    notes: api.notes ?? null,
  };
}

function buildOrphanNode(rootDir: string, entry: OrphanFeatureEntry): FeatureGraphNode | null {
  const featurePath = `src/features/${entry.featureFolder}/`;
  if (!pathExists(rootDir, featurePath)) return null;

  const api = entry.api ?? { routes: [], apiPrefixes: [] };

  return {
    pageKey: entry.pageKey,
    label: entry.label,
    menuGroup: null,
    routePattern: entry.pageKey,
    inStudioMenu: false,
    ui: {
      pageModule: null,
      loaderRef: 'orphan',
      page: null,
      feature: featurePath,
      domain: null,
      workspace: detectWorkspace(rootDir, featurePath),
    },
    api: {
      routes: api.routes,
      apiPrefixes: api.apiPrefixes,
      contracts: api.contracts && pathExists(rootDir, api.contracts) ? api.contracts : api.contracts ?? null,
      services: (api.services ?? []).filter((servicePath) => pathExists(rootDir, servicePath)),
    },
    tests: pathExists(rootDir, `${featurePath}__tests__/`) ? `${featurePath}__tests__/` : null,
    notes: entry.notes,
  };
}

export function buildFeatureGraph(rootDir: string): FeatureGraph {
  const navigationPath = 'src/config/platform-registry/navigation/studio.json';
  const pageModulesDir = 'src/config/platform-registry/page-modules';
  const navigationJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, navigationPath), 'utf8'),
  ) as Parameters<typeof parseStudioNavigation>[0];
  const navItems = parseStudioNavigation(navigationJson);
  const navByKey = new Map(navItems.map((item) => [item.pageKey, item]));
  const modules = readPageModules(path.join(rootDir, pageModulesDir));
  const moduleByKey = new Map(modules.map((item) => [item.pageKey, item]));

  const pageKeys = new Set<string>([
    ...navItems.map((item) => item.pageKey),
    ...modules.map((item) => item.pageKey),
  ]);

  const registryNodes = [...pageKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((pageKey) => buildNode(rootDir, pageKey, navByKey.get(pageKey), moduleByKey.get(pageKey)));

  const orphanNodes = ORPHAN_FEATURES.map((entry) => buildOrphanNode(rootDir, entry)).filter(
    (node): node is FeatureGraphNode => node !== null,
  );

  const nodes = [...registryNodes, ...orphanNodes].sort((a, b) => a.pageKey.localeCompare(b.pageKey));

  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    source: {
      navigation: navigationPath,
      pageModulesDir,
    },
    nodes,
  };
}

export function renderCodebaseIndexMarkdown(graph: FeatureGraph): string {
  const lines: string[] = [
    '# Codebase Index (AI Navigation)',
    '',
    '> **Generated** — do not edit tables by hand. Regenerate: `npm run codegen:ai-index`',
    `> **Source:** \`${graph.source.navigation}\` · ${graph.generatedAt}`,
    '',
    'This map answers **where things live**. Constraints: `AGENTS.md` + one `docs/standards/` shard (`docs/standards/INDEX.md`). Human-only bulk docs: `docs/archive/` (AI-index excluded).',
    '',
    '## Folder convention',
    '',
    '| Layer | Path pattern | Role |',
    '|-------|--------------|------|',
    '| Studio menu | `src/config/platform-registry/navigation/studio.json` | Operator nav groups |',
    '| Page module | `src/config/platform-registry/page-modules/{pageKey}.json` | Loader + default roles |',
    '| Page wrapper | `src/features/{feature}/*Page.tsx` (studio) · `src/pages/` (auth only) | Thin route entry |',
    '| Feature UI | `src/features/{feature}/` | Workspace, hooks, components |',
    '| Domain logic | `src/domain/{area}/` | Designer engine (components page) |',
    '| API routes | `src/server/routes/{domain}.routes.ts` | Express routers |',
    '| Services | `src/server/services/{domain}/` | Business logic |',
    '| Contracts | `src/shared/api/contracts/{domain}/` | Shared types/validators |',
    '',
    '## Platform routing (shell)',
    '',
    'Culture × Application × Route: `ExperienceHost` → `DynamicOutlet` → `resolvers.ts`.',
    'See [`docs/architecture/experience-routing.md`](../architecture/experience-routing.md).',
    '',
    '## Shared UI',
    '',
    '- Components: `src/shared/ui/` — `AppButton`, `AppTableGrid`, `CreateEditModalShell`, …',
    '- Tokens: `src/shared/ui/surfaceClasses.ts`',
    '- Grid booleans: `src/shared/lib/gridCellRenderers.tsx`',
    '',
    '## Menu map',
    '',
  ];

  const groups = new Map<string, FeatureGraphNode[]>();
  const unlisted: FeatureGraphNode[] = [];
  const orphanOnly: FeatureGraphNode[] = [];

  for (const node of graph.nodes) {
    if (node.ui.loaderRef === 'orphan') {
      orphanOnly.push(node);
      continue;
    }
    if (!node.inStudioMenu) {
      unlisted.push(node);
      continue;
    }
    const key = node.menuGroup ?? '(ungrouped)';
    const bucket = groups.get(key) ?? [];
    bucket.push(node);
    groups.set(key, bucket);
  }

  for (const [group, nodes] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${group}`, '');
    lines.push('| pageKey | Label | Feature | API prefix | Workspace |');
    lines.push('|---------|-------|---------|------------|-----------|');
    for (const node of nodes) {
      const prefix = node.api.apiPrefixes.join(', ') || '—';
      const feature = node.ui.feature ?? '—';
      const workspace = node.ui.workspace ?? '—';
      lines.push(`| \`${node.pageKey}\` | ${node.label} | \`${feature}\` | ${prefix} | \`${workspace}\` |`);
    }
    lines.push('');
  }

  if (unlisted.length > 0) {
    lines.push('## Registry-only (not in studio menu)', '');
    lines.push('| pageKey | Label | Feature | Notes |');
    lines.push('|---------|-------|---------|-------|');
    for (const node of unlisted) {
      lines.push(
        `| \`${node.pageKey}\` | ${node.label} | \`${node.ui.feature ?? '—'}\` | ${node.notes ?? '—'} |`,
      );
    }
    lines.push('');
  }

  if (orphanOnly.length > 0) {
    lines.push('## Feature-only (no registry page)', '');
    lines.push('| pageKey | Label | Feature | API prefix | Workspace | Notes |');
    lines.push('|---------|-------|---------|------------|-----------|-------|');
    for (const node of orphanOnly) {
      const prefix = node.api.apiPrefixes.join(', ') || '—';
      lines.push(
        `| \`${node.pageKey}\` | ${node.label} | \`${node.ui.feature ?? '—'}\` | ${prefix} | \`${node.ui.workspace ?? '—'}\` | ${node.notes ?? '—'} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Machine-readable graph', '', '- Full graph: [`feature-graph.json`](./feature-graph.json)', '');

  return `${lines.join('\n')}\n`;
}

export function writeAiIndexArtifacts(rootDir: string): FeatureGraph {
  const graph = buildFeatureGraph(rootDir);
  const aiDir = path.join(rootDir, 'docs/ai');
  fs.mkdirSync(aiDir, { recursive: true });
  fs.writeFileSync(
    path.join(aiDir, 'feature-graph.json'),
    `${JSON.stringify(graph, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(aiDir, 'CODEBASE_INDEX.md'),
    renderCodebaseIndexMarkdown(graph),
    'utf8',
  );
  writeCursorFeatureRules(rootDir, graph);
  writePageEditLockManifest(rootDir, graph);
  writeHawietyCursorPageLockRules(rootDir, graph);
  return graph;
}
