import { describe, expect, it } from 'vitest';
import {
  escapeSqlStringLiteral,
  rewriteUnquotedBooleanKeywords,
  splitSqlGoBatches,
  sqlBooleanLiteral,
  stripAccidentalIdentityInsertArtifacts,
  wrapSqlServerIdentityInserts,
} from '../packageDbScriptSql';

describe('packageDbScriptSql', () => {
  it('splits SQL Server GO batches and keeps a single batch when GO is absent', () => {
    const sql = [
      'IF OBJECT_ID(N\'dbo.cms_contents\', N\'U\') IS NULL CREATE TABLE dbo.cms_contents (id INT);',
      'GO',
      'CREATE INDEX ix_cms ON dbo.cms_contents (id);',
      'GO',
    ].join('\n');
    expect(splitSqlGoBatches(sql)).toEqual([
      'IF OBJECT_ID(N\'dbo.cms_contents\', N\'U\') IS NULL CREATE TABLE dbo.cms_contents (id INT);',
      'CREATE INDEX ix_cms ON dbo.cms_contents (id);',
    ]);
    expect(splitSqlGoBatches('INSERT INTO t VALUES (1);')).toEqual(['INSERT INTO t VALUES (1);']);
  });

  it('emits 1/0 for SQL Server booleans and TRUE/FALSE for Postgres', () => {
    expect(sqlBooleanLiteral(false, 'sqlserver')).toBe('0');
    expect(sqlBooleanLiteral(true, 'postgres')).toBe('TRUE');
  });

  it('rewrites unquoted TRUE/FALSE for SQL Server without touching quoted text', () => {
    const sql = "INSERT INTO cms_contents (title, comments_enabled) VALUES ('FALSE alarm', FALSE);";
    expect(rewriteUnquotedBooleanKeywords(sql, 'sqlserver')).toBe(
      "INSERT INTO cms_contents (title, comments_enabled) VALUES ('FALSE alarm', 0);",
    );
    expect(rewriteUnquotedBooleanKeywords(sql, 'postgres')).toBe(sql);
  });

  it('wraps consecutive identity INSERTs for SQL Server', () => {
    const sql = [
      'INSERT INTO [cms_contents] ([id], [title]) VALUES (1, \'a\');',
      'INSERT INTO [cms_contents] ([id], [title]) VALUES (2, \'b\');',
      'INSERT INTO [cms_content_tags] ([content_id], [tag_code]) VALUES (1, \'x\');',
    ].join('\n');
    const wrapped = wrapSqlServerIdentityInserts(sql, new Set(['cms_contents']));
    expect(wrapped).toContain('SET IDENTITY_INSERT [cms_contents] ON;');
    expect(wrapped).toContain('SET IDENTITY_INSERT [cms_contents] OFF;');
    expect(wrapped).not.toContain('SET IDENTITY_INSERT [cms_content_tags]');
  });

  it('does not inject IDENTITY_INSERT into a multiline markdown body', () => {
    const sql = [
      "INSERT INTO [cms_contents] ([id], [body]) VALUES ('11', 'line one",
      '## heading',
      "line two');",
      "INSERT INTO [cms_content_tags] ([content_id], [tag_code]) VALUES ('11', 'x');",
    ].join('\n');
    const wrapped = wrapSqlServerIdentityInserts(sql, new Set(['cms_contents']));
    expect(wrapped).toMatch(/SET IDENTITY_INSERT \[cms_contents\] ON;\s*INSERT INTO \[cms_contents\]/s);
    expect(wrapped).toContain("## heading");
    const offIndex = wrapped.indexOf('SET IDENTITY_INSERT [cms_contents] OFF;');
    const insertIndex = wrapped.indexOf("INSERT INTO [cms_contents]");
    const tagIndex = wrapped.indexOf('INSERT INTO [cms_content_tags]');
    expect(offIndex).toBeGreaterThan(insertIndex);
    expect(offIndex).toBeLessThan(tagIndex);
    expect(wrapped.slice(insertIndex, offIndex)).not.toContain('SET IDENTITY_INSERT [cms_contents] OFF;');
  });

  it('still wraps when IDENTITY_INSERT text appears inside a string literal', () => {
    const sql = "INSERT INTO [cms_contents] ([id], [body]) VALUES ('11', 'see SET IDENTITY_INSERT [cms_contents] OFF; in docs');";
    const wrapped = wrapSqlServerIdentityInserts(sql, new Set(['cms_contents']));
    expect(wrapped).toContain('SET IDENTITY_INSERT [cms_contents] ON;');
    expect(wrapped.startsWith('SET IDENTITY_INSERT [cms_contents] ON;')).toBe(true);
  });

  it('escapes SQL Server newlines and strips leaked wrap artifacts', () => {
    const raw = 'Hello\nSET IDENTITY_INSERT [cms_contents] OFF;\nWorld';
    expect(stripAccidentalIdentityInsertArtifacts(raw)).toBe('Hello\nWorld');
    expect(escapeSqlStringLiteral('Hello\nWorld', 'SQL Server')).toBe("N'Hello' + CHAR(10) + N'World'");
    expect(escapeSqlStringLiteral("O'Hara", 'PostgreSQL')).toBe("'O''Hara'");
  });
});
