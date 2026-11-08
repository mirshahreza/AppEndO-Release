import { describe, expect, it } from 'vitest';
import { navGroupKey, navLabelKey } from '../../../../core/culture/cultureShellKeys';
import {
  buildPackageStudioModuleExtras,
  PACKAGE_CULTURE_KEYS_ENTRY,
  PACKAGE_STUDIO_NAV_PATCH_ENTRY,
  studioModuleExtraFiles,
} from '../packageStudioModuleExtras';

describe('buildPackageStudioModuleExtras', () => {
  it('returns null when there are no studio routes', () => {
    expect(buildPackageStudioModuleExtras({
      packageName: 'Demo Pack',
      routes: [],
      pageSeeds: [],
    })).toBeNull();
  });

  it('names the Studio nav group after the package and emits English culture keys', () => {
    const extras = buildPackageStudioModuleExtras({
      packageName: 'Demo Pack',
      routes: [{
        pageKey: 'crm-contacts',
        entry: 'ui/crm/contacts.tsx',
        suggestedRoutePattern: 'crm/contacts',
        suggestedMountId: 'studio',
      }],
      pageSeeds: [{
        id: 'draft-1',
        componentKey: 'crm/contacts',
        label: 'Contacts',
        exportBundle: {
          entry: 'ui/crm/contacts.tsx',
          code: 'export default function Contacts() { return null; }',
        },
      }],
    });

    expect(extras).not.toBeNull();
    expect(extras?.navigationPatch).toEqual({
      navigationId: 'studio',
      heading: 'Demo Pack',
      items: [{
        pageKey: 'crm-contacts',
        label: 'Contacts',
        order: 0,
        routePattern: 'crm/contacts',
      }],
    });
    expect(extras?.navigationPatchCapability.entry).toBe(PACKAGE_STUDIO_NAV_PATCH_ENTRY);
    expect(extras?.cultureKeysCapability.entry).toBe(PACKAGE_CULTURE_KEYS_ENTRY);
    expect(extras?.cultureKeys[navGroupKey('Demo Pack')]).toBe('Demo Pack');
    expect(extras?.cultureKeys[navLabelKey('crm-contacts')]).toBe('Contacts');

    const files = studioModuleExtraFiles(extras!);
    expect(files.map((file) => file.entry)).toEqual([
      PACKAGE_STUDIO_NAV_PATCH_ENTRY,
      PACKAGE_CULTURE_KEYS_ENTRY,
    ]);
    expect(JSON.parse(files[0]!.content)).toMatchObject({
      navigationId: 'studio',
      heading: 'Demo Pack',
    });
    expect(JSON.parse(files[1]!.content)[navGroupKey('Demo Pack')]).toBe('Demo Pack');
  });

  it('keeps CMS sidebar to Contents and Settings and skips editor/vocab/comments', () => {
    const extras = buildPackageStudioModuleExtras({
      packageName: 'CMS',
      routes: [
        {
          pageKey: 'cms-contents-editor',
          entry: 'ui/cms/cms-contents-editor.tsx',
          suggestedRoutePattern: 'cms/cms-contents-editor',
          suggestedMountId: 'studio',
        },
        {
          pageKey: 'cms-contents-list',
          entry: 'ui/cms/cms-contents-list.tsx',
          suggestedRoutePattern: 'cms/cms-contents-list',
          suggestedMountId: 'studio',
        },
        {
          pageKey: 'cms-vocab-languages',
          entry: 'ui/cms/cms-vocab-languages.tsx',
          suggestedRoutePattern: 'cms/cms-vocab-languages',
          suggestedMountId: 'studio',
        },
        {
          pageKey: 'cms-settings',
          entry: 'ui/cms/cms-settings.tsx',
          suggestedRoutePattern: 'cms/cms-settings',
          suggestedMountId: 'studio',
        },
        {
          pageKey: 'cms-comments',
          entry: 'ui/cms/cms-comments.tsx',
          suggestedRoutePattern: 'cms/cms-comments',
          suggestedMountId: 'studio',
        },
      ],
      pageSeeds: [],
    });

    expect(extras?.navigationPatch.items).toEqual([
      {
        pageKey: 'cms-contents-list',
        label: 'Contents',
        order: 0,
        icon: 'Newspaper',
        routePattern: 'cms/contents',
      },
      {
        pageKey: 'cms-settings',
        label: 'Settings',
        order: 1,
        icon: 'Settings',
        routePattern: 'cms/settings/*',
      },
    ]);
    expect(extras?.cultureKeys[navLabelKey('cms-contents-list')]).toBe('Contents');
    expect(extras?.cultureKeys[navLabelKey('cms-settings')]).toBe('Settings');
  });

  it('puts Settings last even when the route list has it first', () => {
    const extras = buildPackageStudioModuleExtras({
      packageName: 'CMS',
      routes: [
        {
          pageKey: 'cms-settings',
          entry: 'ui/cms/cms-settings.tsx',
          suggestedRoutePattern: 'cms/cms-settings',
          suggestedMountId: 'studio',
        },
        {
          pageKey: 'cms-contents-list',
          entry: 'ui/cms/cms-contents-list.tsx',
          suggestedRoutePattern: 'cms/cms-contents-list',
          suggestedMountId: 'studio',
        },
      ],
      pageSeeds: [],
    });

    expect(extras?.navigationPatch.items.map((item) => item.pageKey)).toEqual([
      'cms-contents-list',
      'cms-settings',
    ]);
    expect(extras?.navigationPatch.items.map((item) => item.order)).toEqual([0, 1]);
  });
});
