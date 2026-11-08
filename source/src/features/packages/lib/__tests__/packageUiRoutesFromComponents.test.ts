import { describe, expect, it } from 'vitest';
import {
  applyStudioRoutePatternsToUiRoutes,
  buildPackageUiRoutesForPageSeeds,
} from '../packageUiRoutesFromComponents';

describe('packageUiRoutesFromComponents', () => {
  it('uses the live Studio binding when packing a designer page', () => {
    const routes = buildPackageUiRoutesForPageSeeds({
      pageSeeds: [{
        id: 'draft-cms-contents-list',
        componentKey: 'general/cms-contents-list',
        label: 'Contents',
        exportBundle: {
          entry: 'ui/general/cms-contents-list.tsx',
          code: 'export default function Contents() { return null; }',
        },
      }],
    });
    expect(routes[0]).toMatchObject({
      pageKey: 'cms-contents-list',
      suggestedRoutePattern: 'general/cms-contents-list',
    });

    const withLive = applyStudioRoutePatternsToUiRoutes(routes, [{
      pageKey: 'cms-contents-list',
      mountId: 'studio',
      routePattern: 'cms/contents',
    }]);
    expect(withLive[0]?.suggestedRoutePattern).toBe('cms/contents');
  });
});
