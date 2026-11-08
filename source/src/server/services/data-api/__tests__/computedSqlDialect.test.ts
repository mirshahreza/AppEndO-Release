import { describe, expect, it } from 'vitest';
import { compileComputedSqlForDialect } from '../computedSqlDialect';

const COMMENT_COUNT = '(SELECT COUNT(*)::int FROM cms_contents AS child WHERE child.parent_content_id = "{{parent}}"."{{pk}}")';
const TAG_SUMMARY = `(
    SELECT COALESCE(
      STRING_AGG(tag.title_en, ', ' ORDER BY tag.view_order, tag.title_en),
      ''
    )
    FROM cms_content_tags AS content_tag
    INNER JOIN base_info AS tag ON tag.id = content_tag.tag_code
    WHERE content_tag.content_id = "{{parent}}"."{{pk}}"
  )`;
const TAG_ROW_KEY = '(CONCAT(CAST("{{parent}}"."content_id" AS TEXT), \'|\', "{{parent}}"."tag_code"))';

describe('compileComputedSqlForDialect', () => {
  it('leaves canonical postgres SQL unchanged', () => {
    expect(compileComputedSqlForDialect(COMMENT_COUNT, 'postgres')).toBe(COMMENT_COUNT);
    expect(compileComputedSqlForDialect(TAG_SUMMARY, 'postgres')).toBe(TAG_SUMMARY);
  });

  it('compiles CMS list computed SQL to SQL Server', () => {
    const commentCount = compileComputedSqlForDialect(COMMENT_COUNT, 'mssql');
    expect(commentCount).toContain('[{{parent}}].[{{pk}}]');
    expect(commentCount).not.toContain('::int');

    const tagSummary = compileComputedSqlForDialect(TAG_SUMMARY, 'mssql');
    expect(tagSummary).toContain('WITHIN GROUP');
    expect(tagSummary).toContain('[{{parent}}].[{{pk}}]');
    expect(tagSummary).not.toContain('\', \' ORDER BY');
  });

  it('compiles tag composite key CAST TEXT to NVARCHAR', () => {
    const compiled = compileComputedSqlForDialect(TAG_ROW_KEY, 'mssql');
    expect(compiled).toContain('NVARCHAR(1000)');
    expect(compiled).toContain('[{{parent}}].[content_id]');
    expect(compiled).not.toContain(' AS TEXT');
  });

  it('does not rewrite SQL for other dialects', () => {
    expect(compileComputedSqlForDialect(COMMENT_COUNT, 'mysql')).toBe(COMMENT_COUNT);
  });
});
