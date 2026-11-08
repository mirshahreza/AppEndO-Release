import { describe, expect, it } from 'vitest';
import {
  buildPackageBuilderDbObjects,
  OPTIONAL_INSTALL_SQL_ENTRY,
  REQUIRED_INSTALL_SQL_ENTRY,
  areSqlScriptsPaired,
} from '../packageBuilderInitialRecords';

describe('packageBuilderInitialRecords', () => {
  it('omits optional seed when the packer does not include initial records', () => {
    const objects = buildPackageBuilderDbObjects({
      packageId: 'cms',
      installSql: 'CREATE TABLE cms_contents (id int);',
      uninstallSql: 'DROP TABLE cms_contents;',
      includeInitialRecords: false,
      optionalInstallSql: 'INSERT INTO cms_contents VALUES (1);',
      optionalUninstallSql: 'DELETE FROM cms_contents WHERE id = 1;',
    });
    expect(objects).toHaveLength(1);
    expect(objects[0]?.installMode).toBe('required');
    expect(objects[0]?.installScript).toBe(REQUIRED_INSTALL_SQL_ENTRY);
    expect(objects[0]?.installScript.startsWith('db/install/')).toBe(true);
  });

  it('adds an optional seed object when initial records are included', () => {
    const objects = buildPackageBuilderDbObjects({
      packageId: 'cms',
      installSql: 'CREATE TABLE cms_contents (id int);',
      uninstallSql: 'DROP TABLE cms_contents;',
      includeInitialRecords: true,
      optionalInstallSql: 'INSERT INTO cms_contents VALUES (1);',
      optionalUninstallSql: 'DELETE FROM cms_contents WHERE id = 1;',
    });
    expect(objects.map((obj) => obj.installMode)).toEqual(['required', 'optional']);
    expect(objects[1]?.installScript).toBe(OPTIONAL_INSTALL_SQL_ENTRY);
  });

  it('requires install and uninstall SQL to be paired', () => {
    expect(areSqlScriptsPaired('INSERT 1', 'DELETE 1')).toBe(true);
    expect(areSqlScriptsPaired('INSERT 1', '')).toBe(false);
    expect(areSqlScriptsPaired('', '')).toBe(true);
  });
});
