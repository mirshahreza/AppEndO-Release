-- CMS package Phase 1 uninstall (SQL Server)
-- Drops domain tables only. Base Info CMS root/subtree is removed by the seed rollback helper.

IF OBJECT_ID(N'dbo.cms_settings', N'U') IS NOT NULL DROP TABLE dbo.cms_settings;
IF OBJECT_ID(N'dbo.cms_content_relations', N'U') IS NOT NULL DROP TABLE dbo.cms_content_relations;
IF OBJECT_ID(N'dbo.cms_content_tags', N'U') IS NOT NULL DROP TABLE dbo.cms_content_tags;
IF OBJECT_ID(N'dbo.cms_content_assets', N'U') IS NOT NULL DROP TABLE dbo.cms_content_assets;
IF OBJECT_ID(N'dbo.cms_content_revisions', N'U') IS NOT NULL DROP TABLE dbo.cms_content_revisions;
IF OBJECT_ID(N'dbo.cms_contents', N'U') IS NOT NULL DROP TABLE dbo.cms_contents;
