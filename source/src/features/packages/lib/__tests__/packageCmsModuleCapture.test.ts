import { describe, expect, it } from 'vitest';
import { cmsModuleCaptureSummary, joinCapturedSqlParts } from '../packageCmsModuleCapture';

describe('packageCmsModuleCapture', () => {
  it('joins schema and vocab SQL', () => {
    expect(joinCapturedSqlParts('CREATE TABLE t();', '', 'INSERT INTO t VALUES (1);')).toBe(
      'CREATE TABLE t();\n\nINSERT INTO t VALUES (1);',
    );
  });

  it('summarizes a packed CMS module', () => {
    expect(cmsModuleCaptureSummary({
      schemaInstallSql: 'CREATE TABLE cms_contents ();',
      schemaUninstallSql: '',
      vocabInstallSql: 'INSERT INTO base_info VALUES (1);',
      vocabUninstallSql: '',
      vocabHidRows: [{ id: '100.4', parentId: '100', title: 'CMS' }],
      contentInstallSql: '',
      contentUninstallSql: '',
      contentBlobs: [{
        entry: 'db/blobs/files/a.bin',
        table: 'cms_content_assets',
        column: 'file',
        key: { id: '1' },
        contentBase64: 'YQ==',
        byteLength: 1,
      }],
      vocabRowCount: 4,
      contentRowCount: 2,
      tables: ['base_info', 'cms_contents'],
      warnings: [],
    })).toBe('Packed CMS schema · 4 vocab row(s) · 2 content row(s) · 1 file(s).');
  });
});
