import { describe, expect, it } from 'vitest';
import type { NavigationManifest } from '../../../../shared/api/contracts/platform/navigation';
import type { DesignerVersionSummary } from '../../../../shared/api/queries/component-designer';
import {
  normalizeNavigationManifestPageKeys,
  resolvePublicNavigationPageKey,
} from '../navigationManifestPageKeys';

const drafts: DesignerVersionSummary[] = [
  {
    id: 'draft-reports',
    name: 'Reports',
    folder: 'analytics',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    isBuiltIn: false,
  },
];

describe('resolvePublicNavigationPageKey', () => {
  it('maps designer draft ids to component paths', () => {
    expect(resolvePublicNavigationPageKey('draft-reports', drafts)).toBe('analytics/reports');
    expect(resolvePublicNavigationPageKey('analytics/reports', drafts)).toBe('analytics/reports');
    expect(resolvePublicNavigationPageKey('dashboard', drafts)).toBe('dashboard');
  });
});

describe('normalizeNavigationManifestPageKeys', () => {
  it('rewrites legacy draft ids in manifest items', () => {
    const manifest: NavigationManifest = {
      id: 'demo',
      groups: [
        {
          items: [
            { label: 'Reports', pageKey: 'draft-reports', routePattern: 'reports' },
          ],
        },
      ],
    };

    const normalized = normalizeNavigationManifestPageKeys(manifest, drafts);
    expect(normalized.groups[0]?.items[0]?.pageKey).toBe('analytics/reports');
  });
});
