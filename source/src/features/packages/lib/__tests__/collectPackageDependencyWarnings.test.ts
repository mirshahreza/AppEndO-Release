import { describe, expect, it } from 'vitest';
import { collectPackageDependencyWarnings } from '../collectPackageDependencyWarnings';

describe('collectPackageDependencyWarnings', () => {
  it('warns when a nav pageKey has no matching designer draft', () => {
    const warnings = collectPackageDependencyWarnings({
      navigationItems: [{
        key: 'site:missing-page',
        manifestId: 'site',
        groupHeading: 'Main',
        pageKey: 'missing-page',
        label: 'Missing',
        depth: 0,
      }],
      uiComponents: [],
      packedComponents: [],
      managedApis: [],
      edgeApis: [],
      edgeModels: [],
    });

    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unresolved-page',
        message: 'Navigation page "missing-page" has no matching designer draft.',
      }),
    ]);
  });

  it('skips core-prefixed page keys and warns on unmanaged API paths', () => {
    const warnings = collectPackageDependencyWarnings({
      navigationItems: [{
        key: 'studio:packages',
        manifestId: 'studio',
        groupHeading: 'Core',
        pageKey: 'core:packages',
        label: 'Packages',
        depth: 0,
      }],
      uiComponents: [],
      packedComponents: [{
        id: 'page-1',
        componentKey: 'demo/widget',
        label: 'Widget',
        exportBundle: {
          entry: 'ui/demo/widget.tsx',
          code: 'fetch("/api/custom/missing-thing")',
        },
      }],
      managedApis: [],
      edgeApis: [],
      edgeModels: [],
    });

    expect(warnings.some((warning) => warning.code === 'unresolved-page')).toBe(false);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unresolved-api',
        message: 'Path /api/custom/missing-thing is not a managed server function or Edge API.',
      }),
    ]);
  });

  it('warns on custom font profiles that were not packed', () => {
    const warnings = collectPackageDependencyWarnings({
      uiComponents: [],
      packedComponents: [{
        id: 'page-1',
        componentKey: 'demo/widget',
        label: 'Widget',
        exportBundle: {
          entry: 'ui/demo/widget.tsx',
          code: 'export default function Widget() { return null; }',
          draftJson: JSON.stringify({
            document: {
              metadata: {
                fontProfileId: 'brand-serif',
              },
            },
          }),
        },
      }],
      managedApis: [],
      edgeApis: [],
      edgeModels: [],
    });

    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unresolved-font-profile',
        message: 'Font profile "brand-serif" is not a built-in profile and was not packed as a platform font.',
      }),
    ]);
  });
});
