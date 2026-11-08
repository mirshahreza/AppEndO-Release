/**
 * Bug found (Built-in Components phase 21 item 1): eleven admin-page "built-in"
 * mockups (`builtin-page-*` from `adminPageTemplates.ts`) were static container/text
 * shells with hardcoded fake rows — duplicates of real app pages (Users, Roles, …)
 * that already exist as coded features. Product decision: Option A — remove them.
 * Fixed in `builtInComponents.ts` + deleted `adminPageTemplates.ts`: layout
 * starters live in the virtual `templates` folder (`builtin-<presetId>`), not as
 * fake admin pages. Built-in portal shells (`app-shell`) live in `general`.
 */
import { describe, expect, it } from 'vitest';
import {
  getBuiltInComponentRecord,
  getBuiltInPresetId,
  listBuiltInComponentSummaries,
  mergeComponentsCatalog,
  toBuiltInComponentId,
} from '../../../domain/component-designer/layout-presets/builtInComponents';
import { resolveBuiltInTemplateSeeds } from '../../../domain/component-designer/layout-presets/builtInTemplateResolver';
import { isBuiltInShellPresetId } from '../../../domain/component-designer/layout-presets/types';

const LEGACY_ADMIN_PAGE_IDS = [
  'dashboard',
  'server-functions',
  'client-components',
  'plugins',
  'settings',
  'cache',
  'data-sources',
  'logs',
  'users',
  'roles',
  'base-info',
] as const;

describe('builtInAdminPagesRemovalPhase21Fix', () => {
  it('excludes all eleven legacy admin-page mock ids from layout templates', () => {
    const templateIds = listBuiltInComponentSummaries().map((item) => item.id);

    for (const pageId of LEGACY_ADMIN_PAGE_IDS) {
      expect(templateIds).not.toContain(`builtin-page-${pageId}`);
    }

    expect(templateIds.some((id) => id.startsWith('builtin-page-'))).toBe(false);
  });

  it('does not list legacy admin-page mock ids in the merged catalog', () => {
    const catalog = mergeComponentsCatalog([]);
    const builtInIds = catalog.filter((item) => item.isBuiltIn).map((item) => item.id);

    for (const pageId of LEGACY_ADMIN_PAGE_IDS) {
      expect(builtInIds).not.toContain(`builtin-page-${pageId}`);
    }

    expect(builtInIds.some((id) => id.startsWith('builtin-page-'))).toBe(false);
    expect(catalog.filter((item) => item.isBuiltIn).length).toBeGreaterThan(0);
    expect(catalog.filter((item) => item.isBuiltIn && !isBuiltInShellPresetId(item.name)).every((item) => item.folder === 'templates')).toBe(true);
    expect(catalog.find((item) => item.name === 'app-shell')?.folder).toBe('general');
    expect(catalog.find((item) => item.name === 'site-shell')?.folder).toBe('general');
  });

  it('still resolves layout-preset built-ins and rejects legacy admin-page ids', () => {
    const contactId = toBuiltInComponentId('contact-form');
    expect(getBuiltInPresetId(contactId)).toBe('contact-form');
    expect(getBuiltInComponentRecord(contactId)).not.toBeNull();
    expect(resolveBuiltInTemplateSeeds(contactId)?.[0]?.paletteItemId).toBe('html.form');

    for (const pageId of LEGACY_ADMIN_PAGE_IDS) {
      const legacyId = `builtin-page-${pageId}`;
      expect(getBuiltInPresetId(legacyId)).toBeNull();
      expect(getBuiltInComponentRecord(legacyId)).toBeNull();
      expect(resolveBuiltInTemplateSeeds(legacyId)).toBeNull();
    }
  });
});
