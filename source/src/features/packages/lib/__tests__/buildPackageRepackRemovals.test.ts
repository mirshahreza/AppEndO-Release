import { describe, expect, it } from 'vitest';
import {
  buildPackageRepackRemovals,
  countPackageRepackRemovals,
  resolveRepackNavigationRemovalIds,
} from '../buildPackageRepackRemovals';
import type { PackageBundleManifest } from '../../../../shared/api/contracts/package-manifest/types';

const manifest: PackageBundleManifest = {
  id: 'demo-pack',
  name: 'Demo Pack',
  version: '1.0.0',
  requiredAppVersion: '>=1.0.0',
  capabilities: {
    apis: [{
      id: 'get-demo',
      method: 'GET',
      path: '/api/demo',
      entry: 'api/demo.ts',
      timeoutMs: 10000,
      auth: 'admin',
    }],
    ui_components: [{
      componentKey: 'demo/widget',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/demo/widget.tsx',
      order: 100,
    }],
    portals: [{ segment: 'demo', entry: 'platform/portals/demo.json' }],
    navigations: [{ id: 'demo-nav', entry: 'platform/navigations/demo-nav.json' }],
    workflows: [{
      scopeKey: 'global',
      key: 'order-approval',
      entry: 'workflows/global/order-approval.json',
    }],
    db_objects: [],
  },
};

const catalogPortals = [{
  segment: 'demo',
  name: 'Demo Portal',
  enabled: true,
  navigationRef: 'demo-nav',
  shell: { entry: '/shell/demo' },
}];

const catalogNavigations = [{
  id: 'demo-nav',
  builtIn: false,
  groupCount: 1,
  itemCount: 2,
  groups: [],
}];

const emptyMarks = {
  markedForRemovalApiIds: {} as Record<string, boolean>,
  markedForRemovalComponentKeys: {} as Record<string, boolean>,
  markedForRemovalPortalSegments: {} as Record<string, boolean>,
  markedForRemovalWorkflowIds: {} as Record<string, boolean>,
  selectedPortalSegments: {} as Record<string, boolean>,
  catalogPortals,
  catalogNavigations,
};

describe('buildPackageRepackRemovals', () => {
  it('returns null when nothing is marked for removal', () => {
    expect(buildPackageRepackRemovals({
      existingManifest: manifest,
      ...emptyMarks,
    })).toBeNull();
  });

  it('builds removals for marked capabilities and auto-removes orphaned navigations', () => {
    const removals = buildPackageRepackRemovals({
      existingManifest: manifest,
      ...emptyMarks,
      markedForRemovalApiIds: { 'get-demo': true },
      markedForRemovalComponentKeys: { 'demo/widget': true },
      markedForRemovalPortalSegments: { demo: true },
      markedForRemovalWorkflowIds: { 'global/order-approval': true },
    });

    expect(removals).toEqual({
      apis: ['get-demo'],
      ui_components: ['demo/widget'],
      portals: ['demo'],
      navigations: ['demo-nav'],
      workflows: ['global/order-approval'],
    });
    expect(countPackageRepackRemovals({
      existingManifest: manifest,
      ...emptyMarks,
      markedForRemovalApiIds: { 'get-demo': true },
    })).toBe(1);
  });

  it('keeps navigations required by remaining portals', () => {
    expect(resolveRepackNavigationRemovalIds({
      existingManifest: manifest,
      markedForRemovalPortalSegments: {},
      selectedPortalSegments: {},
      catalogPortals,
      catalogNavigations,
    })).toEqual([]);
  });
});
