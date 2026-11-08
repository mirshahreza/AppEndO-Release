import { describe, expect, it } from 'vitest';
import {
  applyHidRewriteMap,
  buildPackageHidRewriteIndex,
  planBaseInfoHidRewrite,
} from '../packageSeedHidRewrite';
import { cmsSchemaInstallPath, CMS_PACKAGE_VOCAB_CAPTURE } from '../cmsPackagePackRecipe';

describe('packageSeedHidRewrite', () => {
  it('keeps captured ids when the destination already has the same titled root', async () => {
    const map = await planBaseInfoHidRewrite(
      [
        { id: '100.4', parentId: '100', title: 'CMS' },
        { id: '100.4.1', parentId: '100.4', title: 'Content Types' },
      ],
      new Map([['100.4', 'CMS']]),
      async () => '200',
    );
    expect(map).toEqual({});
  });

  it('remaps a colliding CMS tree onto a newly allocated root', async () => {
    const map = await planBaseInfoHidRewrite(
      [
        { id: '100.4', parentId: '100', title: 'CMS' },
        { id: '100.4.1', parentId: '100.4', title: 'Content Types' },
        { id: '100.4.1.2', parentId: '100.4.1', title: 'News' },
      ],
      new Map([['100.4', 'Something else']]),
      async () => '200',
    );
    expect(map).toEqual({
      '100.4': '200',
      '100.4.1': '200.1',
      '100.4.1.2': '200.1.2',
    });
  });

  it('rewrites longer HID literals before shorter ones', () => {
    const sql = `INSERT INTO base_info (id) VALUES ('100.4.1');
INSERT INTO cms_settings (comments_policy_code) VALUES ('100.4');`;
    expect(applyHidRewriteMap(sql, { '100.4': '200', '100.4.1': '200.1' })).toBe(
      `INSERT INTO base_info (id) VALUES ('200.1');
INSERT INTO cms_settings (comments_policy_code) VALUES ('200');`,
    );
  });

  it('builds an index only when rows exist', () => {
    expect(buildPackageHidRewriteIndex([])).toBeNull();
    expect(buildPackageHidRewriteIndex([{ id: '100.4', parentId: null, title: 'CMS' }])?.rows).toHaveLength(1);
  });
});

describe('cmsPackagePackRecipe', () => {
  it('maps data source types to CMS schema files', () => {
    expect(cmsSchemaInstallPath('PostgreSQL')).toBe('cms-phase1/db/install/cms_schema.sql');
    expect(cmsSchemaInstallPath('SQL Server')).toBe('cms-phase1/db/install/cms_schema.sqlserver.sql');
    expect(cmsSchemaInstallPath('SQLite')).toBeNull();
    expect(CMS_PACKAGE_VOCAB_CAPTURE.where).toContain('CMS');
  });
});
