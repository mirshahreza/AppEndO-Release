import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { shardForStandardId } from '../../../../../config/projectStandards';
import { STANDARDS_SHARD_PATHS } from '../standardsShardLoader';
import type { ToolExecutionContext } from '../../../agent/types';
import {
  DEFAULT_STANDARDS_QUERY_MAX_RULES,
  DEFAULT_STANDARDS_SHARD_MAX_CHARS,
  getProjectStandardsTool,
} from '../getProjectStandards';

const testToolContext: ToolExecutionContext = {
  mode: 'agent',
  allowedGroups: [],
};

const runGetProjectStandards = (args: Record<string, unknown>) =>
  getProjectStandardsTool.execute(args, testToolContext);

const toolData = (result: { ok: boolean; data?: unknown }) =>
  result.data as Record<string, unknown> | undefined;

describe('getProjectStandards caps', () => {
  it('maps machine ids to markdown shards', () => {
    expect(shardForStandardId('agent.prompt-scope')).toBe('agents-hub');
    expect(shardForStandardId('agent.page-edit-lock')).toBe('agents-hub');
    expect(shardForStandardId('ui.visual.color-it')).toBe('ui-design-system');
    expect(shardForStandardId('ui.appearance.user-scope')).toBe('ui-design-system');
    expect(shardForStandardId('ui.destructive.confirmation.modal')).toBe('ui-dialog');
    expect(shardForStandardId('ui.form.create-edit.content-editor-dialog')).toBe('ui-dialog');
    expect(shardForStandardId('routing.nested-editor.deep-link')).toBe('deep-linking');
    expect(shardForStandardId('ui.inspector-rail.chrome')).toBe('ui-inspector-rail');
    expect(shardForStandardId('ui.inspector-rail.splitter')).toBe('ui-inspector-rail');
    expect(shardForStandardId('package.ui.phase3-contract')).toBe('package-ui');
    expect(shardForStandardId('package.home-portal')).toBe('package-ui');
    expect(shardForStandardId('package.install-rollback')).toBe('package-ui');
    expect(shardForStandardId('package.studio-nav-patch')).toBe('package-ui');
    expect(shardForStandardId('hygiene.optimization.independent-axes')).toBe('optimization');
    expect(shardForStandardId('hygiene.optimization.test-only-is-dead')).toBe('optimization');
    expect(shardForStandardId('auth.login.browser-password-manager')).toBe('dev-auth');
    expect(shardForStandardId('component-designer.crud-set')).toBe('crud-set');
    expect(shardForStandardId('data-api.pivot.dataset-not-layout')).toBe('data-api-pivot');
    expect(shardForStandardId('personalizable-dashboard.domain-is-explicit-whitelist')).toBe('personalizable-dashboard-canvas');
    expect(shardForStandardId('olap-bridge.external-optional-service')).toBe('olap-bridge');
    expect(shardForStandardId('data-studio.studio-meta.schema-identity')).toBe('data-studio');
    expect(shardForStandardId('data-studio.platform-api-inventory')).toBe('data-studio');
    expect(shardForStandardId('data.control-plane.sqlserver-default')).toBe('data-model');
    expect(shardForStandardId('data.control-plane.provider-locked-after-setup')).toBe('data-model');
    expect(shardForStandardId('record-event-log.append-only')).toBe('record-event-log');
    expect(shardForStandardId('platform-ops-dashboards.insights-home')).toBe('platform-ops-dashboards');
  });

  it('registers shard files that exist on disk', () => {
    for (const relative of new Set(Object.values(STANDARDS_SHARD_PATHS))) {
      expect(fs.existsSync(relative), relative).toBe(true);
    }
  });
  it('limits query matches to maxRules (default 20)', async () => {
    const result = await runGetProjectStandards({ query: 'ui' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const standards = toolData(result)?.standards as unknown[] | undefined;
    expect(Array.isArray(standards)).toBe(true);
    expect(standards!.length).toBeLessThanOrEqual(DEFAULT_STANDARDS_QUERY_MAX_RULES);
    if ((toolData(result)?.matchCount as number) > DEFAULT_STANDARDS_QUERY_MAX_RULES) {
      expect(toolData(result)?.truncated).toBe(true);
    }
  });

  it('honors custom maxRules', async () => {
    const result = await runGetProjectStandards({ query: 'ui', maxRules: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((toolData(result)?.standards as unknown[]).length).toBeLessThanOrEqual(3);
    expect(toolData(result)?.maxRules).toBe(3);
  });

  it('truncates shard content to maxChars', async () => {
    const result = await runGetProjectStandards({ shard: 'ui-grid', maxChars: 200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = String(toolData(result)?.content ?? '');
    expect(content.length).toBeLessThanOrEqual(200 + 80);
    expect(toolData(result)?.truncated).toBe(true);
    expect(toolData(result)?.maxChars).toBe(200);
  });

  it('returns full shard when under maxChars', async () => {
    const result = await runGetProjectStandards({
      shard: 'greenfield',
      maxChars: DEFAULT_STANDARDS_SHARD_MAX_CHARS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(toolData(result)?.truncated).toBe(false);
    expect(String(toolData(result)?.content ?? '').length).toBeGreaterThan(0);
  });

  it('loads optimization axis aliases to the same shard file', async () => {
    const keys = [
      'optimization',
      'dead-code',
      'optimization-dead-code',
      'optimization-performance',
      'optimization-security',
    ];
    for (const shard of keys) {
      const result = await runGetProjectStandards({ shard });
      expect(result.ok, shard).toBe(true);
      if (!result.ok) return;
      expect(toolData(result)?.path).toBe('docs/standards/optimization.md');
      expect(String(toolData(result)?.content ?? '')).toContain('محور را اول انتخاب کن');
    }
  });

  it('loads vibe-operator-playbook shard', async () => {
    const result = await runGetProjectStandards({ shard: 'vibe-operator-playbook' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(String(toolData(result)?.content ?? '')).toContain('Platform-constrained');
    expect(toolData(result)?.path).toBe('docs/standards/vibe-operator-playbook.md');
  });

  it('loads vibe-server-function shard (WF-1)', async () => {
    const result = await runGetProjectStandards({ shard: 'vibe-server-function' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(String(toolData(result)?.content ?? '')).toContain('draft_server_function');
    expect(toolData(result)?.path).toBe('docs/standards/vibe-server-function.md');
  });

  it('loads vibe-crud and vibe-designer-edit shards', async () => {
    const crud = await runGetProjectStandards({ shard: 'vibe-crud' });
    const designer = await runGetProjectStandards({ shard: 'vibe-designer-edit' });
    expect(crud.ok).toBe(true);
    expect(designer.ok).toBe(true);
    if (!crud.ok || !designer.ok) return;

    expect(String(toolData(crud)?.content ?? '')).toContain('draft_component_layout');
    expect(String(toolData(designer)?.content ?? '')).toContain('layoutId');
  });

  it('loads constraint shards added to the topic map', async () => {
    const design = await runGetProjectStandards({ shard: 'ui-design-system' });
    const deep = await runGetProjectStandards({ shard: 'deep-linking' });
    const pkg = await runGetProjectStandards({ shard: 'package-ui' });
    expect(design.ok && deep.ok && pkg.ok).toBe(true);
    expect(String(toolData(design)?.content ?? '')).toContain('Tier 1');
    expect(String(toolData(deep)?.content ?? '')).toContain('/edit/');
    expect(String(toolData(pkg)?.content ?? '')).toContain('Base Components');
  });

  it('attaches shard keys to query matches', async () => {
    const result = await runGetProjectStandards({ query: 'checkbox', maxRules: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const standards = toolData(result)?.standards as Array<{ shard?: string }> | undefined;
    expect(standards?.length).toBeGreaterThan(0);
    expect(standards?.every((row) => typeof row.shard === 'string' && row.shard.length > 0)).toBe(true);
  });
});
