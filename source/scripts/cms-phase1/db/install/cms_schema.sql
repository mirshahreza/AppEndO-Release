-- CMS package Phase 1 schema (PostgreSQL)
-- Opt-in only — never run from app bootstrap / controlPlaneSeed.
-- Safe to re-run: IF NOT EXISTS on tables and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS cms_contents (
  id                        BIGSERIAL PRIMARY KEY,
  content_type_code         TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  language_code             TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  slug                      TEXT,
  status_code               TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  status_code_updated_at    TIMESTAMPTZ,
  status_code_updated_by    BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  title                     TEXT,
  summary                   TEXT,
  body                      TEXT,
  body_format_code          TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  seo_title                 TEXT,
  seo_note                  TEXT,
  published_at              TIMESTAMPTZ,
  operator_note             TEXT,
  comments_enabled          BOOLEAN,
  comments_policy_code      TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  comments_body_format_code TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  parent_content_id         BIGINT REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  author_display_name       TEXT,
  author_email              TEXT,
  moderated_by              BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  moderated_at              TIMESTAMPTZ,
  created_by                BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_by                BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_contents_language_slug
  ON cms_contents (language_code, slug);

CREATE INDEX IF NOT EXISTS idx_cms_contents_status_code
  ON cms_contents (status_code);

CREATE INDEX IF NOT EXISTS idx_cms_contents_content_type_code
  ON cms_contents (content_type_code);

CREATE INDEX IF NOT EXISTS idx_cms_contents_published_at
  ON cms_contents (published_at);

CREATE TABLE IF NOT EXISTS cms_content_revisions (
  id            BIGSERIAL PRIMARY KEY,
  content_id    BIGINT NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  revision_no   INTEGER NOT NULL,
  title         TEXT,
  summary       TEXT,
  body          TEXT,
  created_by    BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cms_content_revisions_content_rev UNIQUE (content_id, revision_no)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_revisions_content_id
  ON cms_content_revisions (content_id);

CREATE TABLE IF NOT EXISTS cms_content_assets (
  id            BIGSERIAL PRIMARY KEY,
  content_id    BIGINT NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  file          BYTEA NOT NULL,
  file_xs       BYTEA,
  file_size     INTEGER NOT NULL,
  file_name     TEXT NOT NULL,
  file_mime     TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  sha256        TEXT NOT NULL,
  created_by    BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_content_assets_content_id
  ON cms_content_assets (content_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_cms_content_assets_sha256
  ON cms_content_assets (sha256);

CREATE TABLE IF NOT EXISTS cms_content_tags (
  content_id    BIGINT NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_code      TEXT NOT NULL REFERENCES base_info(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (content_id, tag_code)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_tags_tag_code
  ON cms_content_tags (tag_code);

CREATE TABLE IF NOT EXISTS cms_content_relations (
  id              BIGSERIAL PRIMARY KEY,
  content_id_a    BIGINT NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  content_id_b    BIGINT NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  note            TEXT,
  CONSTRAINT ck_cms_content_relations_ordered CHECK (content_id_a < content_id_b),
  CONSTRAINT uq_cms_content_relations_pair UNIQUE (content_id_a, content_id_b)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_relations_a
  ON cms_content_relations (content_id_a);

CREATE INDEX IF NOT EXISTS idx_cms_content_relations_b
  ON cms_content_relations (content_id_b);

CREATE TABLE IF NOT EXISTS cms_settings (
  id                          BIGINT PRIMARY KEY DEFAULT 1,
  comments_enabled            BOOLEAN NOT NULL,
  comments_policy_code        TEXT NOT NULL REFERENCES base_info(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  comments_body_format_code   TEXT NOT NULL REFERENCES base_info(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  public_cache_ttl_seconds    INTEGER NOT NULL DEFAULT 300,
  updated_by                  BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ck_cms_settings_singleton CHECK (id = 1)
);

-- Idempotent upgrades for existing CMS installs (comments folded into cms_contents).
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS parent_content_id BIGINT REFERENCES cms_contents(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS author_display_name TEXT;
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cms_contents_parent_content_id
  ON cms_contents (parent_content_id);

CREATE INDEX IF NOT EXISTS idx_cms_contents_parent_content_type
  ON cms_contents (parent_content_id, content_type_code);

DROP TABLE IF EXISTS cms_comments CASCADE;

COMMIT;
