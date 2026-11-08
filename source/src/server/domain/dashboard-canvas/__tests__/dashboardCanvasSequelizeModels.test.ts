import { describe, expect, it } from 'vitest';
import { dropLegacyDashboardWidgetCommentIndexSql } from '../dashboardCanvasSequelizeModels';

describe('dropLegacyDashboardWidgetCommentIndexSql', () => {
  it('requires table + index names for SQL Server', () => {
    const sql = dropLegacyDashboardWidgetCommentIndexSql('mssql');
    expect(sql).toContain('DROP INDEX [base_dashboard_widget_comments_page_id_widget_node_id_created_a]');
    expect(sql).toContain('ON [base_dashboard_widget_comments]');
    expect(sql).toContain('OBJECT_ID');
  });

  it('keeps Postgres/SQLite DROP INDEX IF EXISTS without ON table', () => {
    expect(dropLegacyDashboardWidgetCommentIndexSql('postgres')).toBe(
      'DROP INDEX IF EXISTS "base_dashboard_widget_comments_page_id_widget_node_id_created_a"',
    );
    expect(dropLegacyDashboardWidgetCommentIndexSql('sqlite')).toBe(
      'DROP INDEX IF EXISTS "base_dashboard_widget_comments_page_id_widget_node_id_created_a"',
    );
  });
});
