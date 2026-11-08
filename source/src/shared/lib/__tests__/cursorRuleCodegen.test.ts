import { describe, expect, it } from 'vitest';
import { buildFeatureGraph } from '../aiIndexCodegen';
import {
  CURSOR_FEATURE_RULE_SPECS,
  featureRuleFileName,
  renderCursorFeatureRuleMdc,
  writeCursorFeatureRules,
} from '../cursorRuleCodegen';

describe('cursorRuleCodegen', () => {
  it('renders package-manager rule with graph paths', () => {
    const graph = buildFeatureGraph(process.cwd());
    const overrides = CURSOR_FEATURE_RULE_SPECS.find((entry) => entry.pageKey === 'package-manager');
    const node = graph.nodes.find((entry) => entry.pageKey === 'package-manager');
    expect(overrides).toBeDefined();
    expect(node).toBeDefined();
    if (!overrides || !node) return;

    const mdc = renderCursorFeatureRuleMdc(node, overrides);
    expect(mdc).toContain('pageKey: package-manager');
    expect(mdc).toContain('get_feature_graph');
    expect(mdc).toContain('src/features/packages/**');
    expect(mdc).toContain('src/core/packages/**');
    expect(mdc).toContain('**Surface:**');
    expect(mdc).toContain('PackagesWorkspace');
  });

  it('writeCursorFeatureRules writes a rule for every graph node with a feature folder', () => {
    const graph = buildFeatureGraph(process.cwd());
    const written = writeCursorFeatureRules(process.cwd(), graph);
    const expectedNodes = graph.nodes.filter((node) => node.ui.feature);
    expect(written).toHaveLength(expectedNodes.length);
    for (const node of expectedNodes) {
      expect(written).toContain(featureRuleFileName(node.pageKey));
    }
  });

  it('renders edge rule with standards doc lines', () => {
    const graph = buildFeatureGraph(process.cwd());
    const overrides = CURSOR_FEATURE_RULE_SPECS.find((entry) => entry.pageKey === 'server-functions');
    const node = graph.nodes.find((entry) => entry.pageKey === 'server-functions');
    expect(overrides).toBeDefined();
    expect(node).toBeDefined();
    if (!overrides || !node) return;

    const mdc = renderCursorFeatureRuleMdc(node, overrides);
    expect(mdc).toContain('data-studio.md');
    expect(mdc).toContain('ServerFunctionsWorkspace');
    expect(mdc).toContain('get_feature_graph');
  });

  it('renders cache rule with cache-keys standard', () => {
    const graph = buildFeatureGraph(process.cwd());
    const overrides = CURSOR_FEATURE_RULE_SPECS.find((entry) => entry.pageKey === 'cache');
    const node = graph.nodes.find((entry) => entry.pageKey === 'cache');
    expect(overrides).toBeDefined();
    expect(node).toBeDefined();
    if (!overrides || !node) return;

    const mdc = renderCursorFeatureRuleMdc(node, overrides);
    expect(mdc).toContain('pageKey: cache');
    expect(mdc).toContain('cache-keys.md');
    expect(mdc).toContain('CacheWorkspace');
  });

  it('auto-generates dashboard rule without manual override entry', () => {
    const graph = buildFeatureGraph(process.cwd());
    const node = graph.nodes.find((entry) => entry.pageKey === 'dashboard');
    expect(node?.ui.feature).toBeTruthy();
    if (!node) return;

    const mdc = renderCursorFeatureRuleMdc(node);
    expect(mdc).toContain('pageKey: dashboard');
    expect(mdc).toContain('src/features/dashboard/**');
    expect(featureRuleFileName('dashboard')).toBe('feature-dashboard.mdc');
  });
});
