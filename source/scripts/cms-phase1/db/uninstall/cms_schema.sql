-- CMS package Phase 1 uninstall (PostgreSQL)
-- Drops domain tables only. Base Info CMS root/subtree is removed by the seed rollback helper.

BEGIN;

DROP TABLE IF EXISTS cms_settings CASCADE;
DROP TABLE IF EXISTS cms_content_relations CASCADE;
DROP TABLE IF EXISTS cms_content_tags CASCADE;
DROP TABLE IF EXISTS cms_content_assets CASCADE;
DROP TABLE IF EXISTS cms_content_revisions CASCADE;
DROP TABLE IF EXISTS cms_contents CASCADE;

COMMIT;
