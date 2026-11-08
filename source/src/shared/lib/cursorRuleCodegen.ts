import fs from 'node:fs';
import path from 'node:path';
import type { FeatureGraph, FeatureGraphNode } from './aiIndexCodegen';
import { PAGE_KEY_TO_FEATURE } from './aiIndexCodegen';

export type CursorFeatureRuleOverride = {
  pageKey: string;
  extraGlobs?: string[];
  docLines?: string[];
};

/** Per-feature overrides — all graph nodes with a feature folder get a rule; only extra globs/docs here. */
export const CURSOR_FEATURE_RULE_SPECS: CursorFeatureRuleOverride[] = [
  {
    pageKey: 'server-functions',
    extraGlobs: [
      'src/server/routes/server-functions.routes.ts',
      'src/server/routes/functions.routes.ts',
    ],
    docLines: [
      '- **Data API configure dialog:** `src/features/data-studio/components/ConfigureDataApiDialog.tsx`',
      '- **Standards:** `docs/standards/data-studio.md` · `docs/standards/server-functions-openapi.md`',
    ],
  },
  {
    pageKey: 'client-components',
    extraGlobs: [
      'src/domain/component-designer/**',
      'src/server/routes/component-designer.routes.ts',
    ],
    docLines: [
      '- **Dialogs:** must use `DesignerDialog` + native `::backdrop` — see `docs/standards/ui-dialog.md`',
      '- **Deep docs (explicit `@` only):** `docs/archive/component-designer/feature-report.md` — folder is `.cursorignore`d',
    ],
  },
  {
    pageKey: 'platform-portals',
    extraGlobs: [
      'src/app/platform/**',
      'src/server/services/platform/**',
    ],
    docLines: [
      '- **Routing:** `PortalHost` · `PortalUrlResolver` · `ShellRouteOutlet` in `src/app/platform/`',
      '- **Manifest compile:** `src/server/services/platform/compileExperienceManifest.ts`',
      '- **Architecture:** `docs/architecture/experience-routing.md`',
    ],
  },
  {
    pageKey: 'package-manager',
    extraGlobs: [
      'src/core/packages/**',
      'src/server/routes/packages.routes.ts',
      'src/server/routes/package.routes.ts',
      'src/server/services/package/**',
      'src/server/services/package-runtime/**',
      'src/shared/api/contracts/package/**',
    ],
    docLines: [
      '- **Contract (active):** `docs/architecture/artifacts.md`',
      '- **Standards:** `docs/standards/greenfield.md` — Package naming only in new code',
    ],
  },
  {
    pageKey: 'libraries',
    extraGlobs: [
      'src/server/routes/libraries.routes.ts',
      'src/server/services/libraries/**',
      'src/shared/api/contracts/libraries/**',
    ],
  },
  {
    pageKey: 'settings',
    extraGlobs: [
      'src/server/routes/settings.routes.ts',
      'src/server/routes/settings-attributes.routes.ts',
      'src/server/routes/ai.routes.ts',
      'src/server/routes/mcp.routes.ts',
      'src/server/services/settings/**',
      'src/server/services/ai/**',
    ],
    docLines: [
      '- **Standards:** `docs/standards/ui-core.md` (forms) · `docs/standards/ai-mcp.md`',
    ],
  },
  {
    pageKey: 'cache',
    docLines: [
      '- **Standards:** `docs/standards/cache-keys.md`',
    ],
  },
  {
    pageKey: 'git',
    extraGlobs: [
      'src/server/services/git/**',
    ],
    docLines: [
      '- **Tests:** `src/features/git/__tests__/`',
    ],
  },
  {
    pageKey: 'ssh-hub',
    extraGlobs: [
      'src/server/routes/ssh-hub.routes.ts',
      'src/server/services/ssh-hub/**',
    ],
    docLines: [
      '- **Package:** Remote Hubs (`remote-hubs`) — gated host module; not always-on Core',
      '- **Secrets:** AES-256-GCM in the Core Credential Vault (`APPENDO_CREDENTIAL_MASTER_KEY`); never log or return plaintext passwords/keys',
      '- **Tests:** `src/features/ssh-hub/__tests__/` · `src/server/services/ssh-hub/__tests__/`',
    ],
  },
  {
    pageKey: 'rdp-hub',
    extraGlobs: [
      'src/server/routes/rdp-hub.routes.ts',
      'src/server/services/rdp-hub/**',
    ],
    docLines: [
      '- **Package:** Remote Hubs (`remote-hubs`) — gated host module; not always-on Core',
      '- **Secrets:** AES-256-GCM in the Core Credential Vault (`APPENDO_CREDENTIAL_MASTER_KEY`); session tickets never include plaintext passwords',
      '- **Runtime:** Apache `guacd` (default `127.0.0.1:4822`) + `guacamole-lite` + `guacamole-common-js`',
      '- **Tests:** `src/features/rdp-hub/__tests__/` · `src/server/services/rdp-hub/__tests__/` · `src/shared/api/contracts/rdp-hub/__tests__/`',
    ],
  },
  {
    pageKey: 'file-hub',
    extraGlobs: [
      'src/server/routes/file-hub.routes.ts',
      'src/server/services/file-hub/**',
    ],
    docLines: [
      '- **Package:** Remote Hubs (`remote-hubs`) — gated host module; not always-on Core',
      '- **Secrets:** AES-256-GCM in the Core Credential Vault (`APPENDO_CREDENTIAL_MASTER_KEY`); never log or return plaintext passwords/keys',
      '- **Transfers:** stream SFTP/FTP uploads and downloads — do not buffer entire files',
      '- **Tests:** `src/features/file-hub/__tests__/` · `src/server/services/file-hub/__tests__/` · `src/shared/api/contracts/file-hub/__tests__/`',
    ],
  },
  {
    pageKey: 'users',
    extraGlobs: [
      'src/server/routes/profile.routes.ts',
      'src/server/services/users/**',
    ],
    docLines: [
      '- **Standards:** `docs/standards/crud-pages.md` · `docs/standards/data-model.md`',
    ],
  },
  {
    pageKey: 'roles',
    extraGlobs: [
      'src/server/routes/users.routes.ts',
    ],
    docLines: [
      '- **Standards:** `docs/standards/crud-pages.md` · `docs/standards/ui-dialog.md` (access editor)',
    ],
  },
  {
    pageKey: 'logs',
    extraGlobs: [
      'src/server/services/logs.service.ts',
    ],
    docLines: [
      '- **Tests:** `src/features/logs/__tests__/`',
    ],
  },
  {
    pageKey: 'sources',
    extraGlobs: [
      'src/server/routes/data-source-schema.routes.ts',
      'src/server/routes/db-enrichment.routes.ts',
    ],
    docLines: [
      '- **Tests:** `src/features/data-sources/__tests__/`',
    ],
  },
  {
    pageKey: 'data-studio',
    extraGlobs: [
      'src/features/data-sources/**',
      'src/server/routes/data-sources.routes.ts',
      'src/server/routes/data-source-schema.routes.ts',
    ],
    docLines: [
      '- **Connections:** create/edit UI on Data Sources page (`src/features/data-sources/`)',
      '- **Tests:** `src/features/data-studio/**/__tests__/`',
    ],
  },
  {
    pageKey: 'chat-history',
    extraGlobs: [
      'src/server/routes/ai.routes.ts',
      'src/shared/api/contracts/ai/**',
    ],
    docLines: [
      '- **Standards:** `docs/standards/ai-mcp.md`',
      '- **Tests:** `src/features/chat-history/__tests__/`',
    ],
  },
];

export function featureRuleFileName(pageKey: string): string {
  const featureFolder = PAGE_KEY_TO_FEATURE[pageKey] ?? pageKey;
  return `feature-${featureFolder}.mdc`;
}

export function defaultFeatureRuleDescription(node: FeatureGraphNode): string {
  if (node.ui.workspace) {
    return `${node.label} — ${node.ui.workspace} entry`;
  }
  return `${node.label} — studio feature`;
}

function formatWorkspacePath(node: FeatureGraphNode): string | null {
  if (!node.ui.feature || !node.ui.workspace) return null;
  const featureDir = node.ui.feature.replace(/\/$/, '');
  return `${featureDir}/components/${node.ui.workspace}.tsx`;
}

export function renderCursorFeatureRuleMdc(
  node: FeatureGraphNode,
  overrides?: Pick<CursorFeatureRuleOverride, 'extraGlobs' | 'docLines'>,
): string {
  const globs = [
    ...(node.ui.feature ? [`${node.ui.feature.replace(/\/$/, '')}/**`] : []),
    ...(overrides?.extraGlobs ?? []),
  ];
  const uniqueGlobs = [...new Set(globs)];
  const description = defaultFeatureRuleDescription(node);

  const lines: string[] = [
    '---',
    `description: ${description}`,
    'globs:',
    ...uniqueGlobs.map((glob) => `  - ${glob}`),
    'alwaysApply: false',
    '---',
    '',
    `# ${node.label} (\`pageKey: ${node.pageKey}\`)`,
    '',
    `- **Graph node:** \`get_feature_graph({ pageKey: "${node.pageKey}" })\``,
  ];

  const workspacePath = formatWorkspacePath(node);
  const surfaceParts: string[] = [];
  if (workspacePath) {
    surfaceParts.push(`workspace \`${workspacePath}\``);
  }
  if (node.ui.page) {
    surfaceParts.push(`page \`${node.ui.page}\` → \`${node.ui.loaderRef}\``);
  }
  if (node.api.apiPrefixes.length > 0) {
    surfaceParts.push(`API ${node.api.apiPrefixes.join(' · ')}`);
  }
  if (node.api.routes.length > 0) {
    surfaceParts.push(`routes ${node.api.routes.map((route) => `\`${route}\``).join(' · ')}`);
  }
  if (surfaceParts.length > 0) {
    lines.push(`- **Surface:** ${surfaceParts.join(' · ')}`);
  }
  if (node.ui.domain) {
    lines.push(`- **Domain engine:** \`${node.ui.domain.replace(/\/$/, '')}/\``);
  }
  if (node.api.contracts) {
    lines.push(`- **Contracts:** \`${node.api.contracts}\``);
  }
  if (overrides?.docLines?.length) {
    lines.push(...overrides.docLines);
  }

  lines.push(
    `- **Edit lock:** page is **locked** under policy \`all-locked\` — do **not** edit these paths unless the operator's **current prompt** explicitly names \`pageKey: ${node.pageKey}\`, route \`${node.routePattern}\`, or this page label.`,
    '- **Policy:** \`.cursor/rules/operator-page-edit-lock.mdc\` · manifest \`docs/ai/page-edit-locks.json\`',
  );

  lines.push('');
  return `${lines.join('\n')}`;
}

export function writeCursorFeatureRules(rootDir: string, graph: FeatureGraph): string[] {
  const rulesDir = path.join(rootDir, '.cursor/rules');
  fs.mkdirSync(rulesDir, { recursive: true });

  const overridesByKey = new Map(
    CURSOR_FEATURE_RULE_SPECS.map((spec) => [spec.pageKey, spec]),
  );

  const written: string[] = [];
  for (const node of graph.nodes) {
    if (!node.ui.feature) continue;

    const overrides = overridesByKey.get(node.pageKey);
    const fileName = featureRuleFileName(node.pageKey);
    const outPath = path.join(rulesDir, fileName);
    fs.writeFileSync(outPath, renderCursorFeatureRuleMdc(node, overrides), 'utf8');
    written.push(fileName);
  }

  return written.sort((a, b) => a.localeCompare(b));
}
