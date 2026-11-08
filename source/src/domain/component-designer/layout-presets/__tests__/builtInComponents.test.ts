import { describe, expect, it } from 'vitest';
import {
  LAYOUT_TEMPLATE_FOLDER,
  getBuiltInComponentRecord,
  getBuiltInComponentRecordByName,
  isLayoutTemplateSummary,
  listBuiltInComponentSummaries,
  mergeComponentsCatalog,
  toBuiltInComponentId,
} from '../builtInComponents';

describe('builtInComponents catalog vs templates', () => {
  it('keeps page starters in the templates folder and shells in general', () => {
    const items = listBuiltInComponentSummaries();
    const templates = items.filter((item) => isLayoutTemplateSummary(item));
    const shells = items.filter((item) => !isLayoutTemplateSummary(item));

    expect(templates.some((item) => item.name === 'blog-list')).toBe(true);
    expect(templates.every((item) => item.folder === LAYOUT_TEMPLATE_FOLDER)).toBe(true);
    expect(templates.every((item) => item.isBuiltIn)).toBe(true);

    expect(shells.some((item) => item.name === 'app-shell')).toBe(true);
    expect(shells.some((item) => item.name === 'site-shell')).toBe(true);
    expect(shells.every((item) => item.folder === 'general')).toBe(true);
    expect(isLayoutTemplateSummary({
      name: 'app-shell',
      folder: 'general',
      isBuiltIn: true,
    })).toBe(false);
  });

  it('merges templates into the catalog under templates/, separate from saved drafts and shells', () => {
    const catalog = mergeComponentsCatalog([
      {
        id: 'draft-cms-contents-list',
        name: 'cms-contents-list',
        folder: 'general',
        createdAt: '2026-08-01T10:48:14.340Z',
        updatedAt: '2026-08-12T01:06:26.543Z',
        createdBy: 'cms-phase3',
        updatedBy: 'cms-phase3',
        isBuiltIn: false,
      },
    ]);

    const saved = catalog.filter((item) => !item.isBuiltIn);
    const builtIns = catalog.filter((item) => item.isBuiltIn);
    const templates = builtIns.filter((item) => isLayoutTemplateSummary(item));
    const shells = builtIns.filter((item) => !isLayoutTemplateSummary(item));

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('cms-contents-list');
    expect(saved[0]?.folder).toBe('general');
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((item) => item.folder === LAYOUT_TEMPLATE_FOLDER)).toBe(true);
    expect(templates.some((item) => item.name === 'blog-list')).toBe(true);
    expect(shells.some((item) => item.name === 'app-shell')).toBe(true);
    expect(shells.some((item) => item.name === 'site-shell')).toBe(true);
    expect(shells.every((item) => item.folder === 'general')).toBe(true);
  });

  it('hides a built-in starter when a saved draft uses the same name', () => {
    const catalog = mergeComponentsCatalog([
      {
        id: 'draft-blog-list',
        name: 'blog-list',
        folder: 'general',
        createdAt: '2026-08-01T10:48:14.340Z',
        updatedAt: '2026-08-12T01:06:26.543Z',
        isBuiltIn: false,
      },
    ]);

    expect(catalog.filter((item) => item.name === 'blog-list')).toHaveLength(1);
    expect(catalog.find((item) => item.name === 'blog-list')?.isBuiltIn).toBe(false);
    expect(catalog.find((item) => item.id === toBuiltInComponentId('blog-list'))).toBeUndefined();
  });

  it('hides a built-in shell when a saved overlay uses the same name', () => {
    const catalog = mergeComponentsCatalog([
      {
        id: 'draft-app-shell',
        name: 'app-shell',
        folder: 'general',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isBuiltIn: false,
      },
    ]);

    expect(catalog.filter((item) => item.name === 'app-shell')).toHaveLength(1);
    expect(catalog.find((item) => item.name === 'app-shell')?.isBuiltIn).toBe(false);
    expect(catalog.find((item) => item.id === toBuiltInComponentId('app-shell'))).toBeUndefined();
  });

  it('resolves a template by name or templates/name path', () => {
    const byName = getBuiltInComponentRecordByName('blog-list');
    const byPath = getBuiltInComponentRecordByName(`${LAYOUT_TEMPLATE_FOLDER}/blog-list`);
    const byId = getBuiltInComponentRecord(toBuiltInComponentId('blog-list'));

    expect(byName?.name).toBe('blog-list');
    expect(byName?.folder).toBe(LAYOUT_TEMPLATE_FOLDER);
    expect(byPath?.id).toBe(byName?.id);
    expect(byId?.id).toBe(byName?.id);
  });

  it('resolves the built-in site-shell in the main catalog folder', () => {
    const byName = getBuiltInComponentRecordByName('site-shell');
    const byPath = getBuiltInComponentRecordByName('general/site-shell');
    const byId = getBuiltInComponentRecord(toBuiltInComponentId('site-shell'));

    expect(byName?.name).toBe('site-shell');
    expect(byName?.folder).toBe('general');
    expect(byPath?.id).toBe(byName?.id);
    expect(byId?.id).toBe(byName?.id);
  });
});
