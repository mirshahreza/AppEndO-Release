import fs from 'node:fs';
import path from 'node:path';

/** Canonical shard key → markdown path. Aliases share a path. */
export const STANDARDS_SHARD_PATHS: Record<string, string> = {
  'agents-hub': 'AGENTS.md',
  'ui-design-system': 'docs/standards/ui-design-system.md',
  'ui-core': 'docs/standards/ui-core.md',
  'ui-dialog': 'docs/standards/ui-dialog.md',
  'ui-toolbar': 'docs/standards/ui-toolbar.md',
  'ui-grid': 'docs/standards/ui-grid.md',
  'ui-inspector-rail': 'docs/standards/ui-inspector-rail.md',
  'ui-side-panel': 'docs/standards/ui-inspector-rail.md',
  'crud-pages': 'docs/standards/crud-pages.md',
  'crud-set': 'docs/standards/crud-set.md',
  confirmations: 'docs/standards/confirmations.md',
  'deep-linking': 'docs/standards/deep-linking.md',
  'data-model': 'docs/standards/data-model.md',
  'identity-profile': 'docs/standards/identity-profile.md',
  greenfield: 'docs/standards/greenfield.md',
  'dev-auth': 'docs/standards/dev-auth.md',
  'data-studio': 'docs/standards/data-studio.md',
  'data-api-pivot': 'docs/standards/data-api-pivot.md',
  pivot: 'docs/standards/data-api-pivot.md',
  'personalizable-dashboard-canvas': 'docs/standards/personalizable-dashboard-canvas.md',
  'olap-bridge': 'docs/standards/olap-bridge.md',
  'rolap-star-schema': 'docs/standards/rolap-star-schema.md',
  'mongodb-analytics-provider': 'docs/standards/mongodb-analytics-provider.md',
  'elasticsearch-analytics-provider': 'docs/standards/elasticsearch-analytics-provider.md',
  'pivot-threshold-alerts': 'docs/standards/pivot-threshold-alerts.md',
  'dashboard-widget-comments': 'docs/standards/dashboard-widget-comments.md',
  'dashboard-ai-assist': 'docs/standards/dashboard-ai-assist.md',
  'dashboard-sharing': 'docs/standards/dashboard-sharing.md',
  'data-studio-modeler': 'docs/standards/data-studio-modeler.md',
  'edge-openapi': 'docs/standards/server-functions-openapi.md',
  'cache-keys': 'docs/standards/cache-keys.md',
  'mcp-servers': 'docs/standards/ai-mcp.md',
  'ai-mcp': 'docs/standards/ai-mcp.md',
  'record-event-log': 'docs/standards/record-event-log.md',
  'platform-ops-dashboards': 'docs/standards/platform-ops-dashboards.md',
  'package-ui': 'docs/standards/package-ui.md',
  'package-base-info-vocab': 'docs/standards/package-base-info-vocab.md',
  'component-designer': 'docs/standards/component-designer.md',
  'workflow-engine-testing': 'docs/standards/workflow-engine-testing.md',
  optimization: 'docs/standards/optimization.md',
  'dead-code': 'docs/standards/optimization.md',
  'optimization-dead-code': 'docs/standards/optimization.md',
  'optimization-performance': 'docs/standards/optimization.md',
  'optimization-security': 'docs/standards/optimization.md',
  'appendoo-workflows': 'docs/standards/vibe-coding-workflows.md',
  'vibe-coding-workflows': 'docs/standards/vibe-coding-workflows.md',
  'vibe-operator-playbook': 'docs/standards/vibe-operator-playbook.md',
  'vibe-server-function': 'docs/standards/vibe-server-function.md',
  'vibe-crud': 'docs/standards/vibe-crud.md',
  'vibe-designer-edit': 'docs/standards/vibe-designer-edit.md',
};

export const normalizeStandardsShardKey = (shardKey: string): string => (
  shardKey.trim().toLowerCase().replace(/\.md$/, '')
);

export const loadStandardsShardContent = (
  shardKey: string,
  maxChars?: number,
): { ok: true; content: string; path: string; truncated: boolean } | { ok: false; error: string } => {
  const normalized = normalizeStandardsShardKey(shardKey);
  const relativePath = STANDARDS_SHARD_PATHS[normalized];
  if (!relativePath) {
    const known = Object.keys(STANDARDS_SHARD_PATHS).join(', ');
    return { ok: false, error: `Unknown shard "${shardKey}". Known shards: ${known}` };
  }

  const absolutePath = path.join(process.cwd(), relativePath);
  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    if (typeof maxChars === 'number' && maxChars > 0 && raw.length > maxChars) {
      return {
        ok: true,
        content: `${raw.slice(0, maxChars)}\n\n… (truncated)`,
        path: relativePath,
        truncated: true,
      };
    }
    return { ok: true, content: raw, path: relativePath, truncated: false };
  } catch {
    return { ok: false, error: `Shard file not found: ${relativePath}` };
  }
};
