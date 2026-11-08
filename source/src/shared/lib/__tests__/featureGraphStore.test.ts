import { describe, expect, it } from 'vitest';
import { buildFeatureGraph } from '../aiIndexCodegen';
import {
  findFeatureGraphNode,
  resolveFeatureSearchRoots,
  resolvePageKeyFromFilePath,
} from '../featureGraphStore';

describe('featureGraphStore search roots', () => {
  it('resolves feature folder and API paths for edge pageKey', () => {
    const graph = buildFeatureGraph(process.cwd());
    const node = findFeatureGraphNode(graph, 'server-functions');
    expect(node).toBeDefined();
    if (!node) return;

    const roots = resolveFeatureSearchRoots(node);
    expect(roots).toContain('src/features/server-functions');
    expect(roots).toContain('src/server/routes');
    expect(roots).toContain('src/shared/api/contracts/server-functions');
  });

  it('includes domain path for component designer', () => {
    const graph = buildFeatureGraph(process.cwd());
    const node = findFeatureGraphNode(graph, 'client-components');
    expect(node).toBeDefined();
    if (!node) return;

    const roots = resolveFeatureSearchRoots(node);
    expect(roots).toContain('src/features/component-designer');
    expect(roots).toContain('src/domain/component-designer');
  });

  it('resolves pageKey from file path using longest matching search root', () => {
    const graph = buildFeatureGraph(process.cwd());
    expect(resolvePageKeyFromFilePath('src/features/server-functions/hooks/index.ts', graph)).toBe('server-functions');
    expect(resolvePageKeyFromFilePath('src/domain/component-designer/propRegistry.ts', graph)).toBe('client-components');
    expect(resolvePageKeyFromFilePath('src/shared/ui/AppButton.tsx', graph)).toBeUndefined();
  });
});
