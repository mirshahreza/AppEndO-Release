-- CMS package Phase 1 schema (SQL Server)
-- Opt-in only — never run from app bootstrap / controlPlaneSeed.
-- Idempotent: guarded by OBJECT_ID / sys.indexes checks.

IF OBJECT_ID(N'dbo.cms_contents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_contents (
    id                        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    content_type_code         NVARCHAR(1000) NULL,
    language_code             NVARCHAR(1000) NULL,
    slug                      NVARCHAR(1000) NULL,
    status_code               NVARCHAR(1000) NULL,
    status_code_updated_at    DATETIME2 NULL,
    status_code_updated_by    BIGINT NULL,
    title                     NVARCHAR(MAX) NULL,
    summary                   NVARCHAR(MAX) NULL,
    body                      NVARCHAR(MAX) NULL,
    body_format_code          NVARCHAR(1000) NULL,
    seo_title                 NVARCHAR(MAX) NULL,
    seo_note                  NVARCHAR(MAX) NULL,
    published_at              DATETIME2 NULL,
    operator_note             NVARCHAR(MAX) NULL,
    comments_enabled          BIT NULL,
    comments_policy_code      NVARCHAR(1000) NULL,
    comments_body_format_code NVARCHAR(1000) NULL,
    parent_content_id         BIGINT NULL,
    author_display_name       NVARCHAR(MAX) NULL,
    author_email              NVARCHAR(MAX) NULL,
    moderated_by              BIGINT NULL,
    moderated_at              DATETIME2 NULL,
    created_by                BIGINT NULL,
    created_at                DATETIME2 NULL CONSTRAINT DF_cms_contents_created_at DEFAULT SYSUTCDATETIME(),
    updated_by                BIGINT NULL,
    updated_at                DATETIME2 NULL CONSTRAINT DF_cms_contents_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cms_contents_content_type FOREIGN KEY (content_type_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_language FOREIGN KEY (language_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_body_format FOREIGN KEY (body_format_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_comments_policy FOREIGN KEY (comments_policy_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_comments_body_format FOREIGN KEY (comments_body_format_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_contents_parent FOREIGN KEY (parent_content_id) REFERENCES dbo.cms_contents(id),
    CONSTRAINT FK_cms_contents_status_updated_by FOREIGN KEY (status_code_updated_by) REFERENCES dbo.base_users(id),
    CONSTRAINT FK_cms_contents_created_by FOREIGN KEY (created_by) REFERENCES dbo.base_users(id),
    CONSTRAINT FK_cms_contents_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.base_users(id),
    CONSTRAINT FK_cms_contents_moderated_by FOREIGN KEY (moderated_by) REFERENCES dbo.base_users(id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_cms_contents_language_slug' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE UNIQUE INDEX uq_cms_contents_language_slug ON dbo.cms_contents (language_code, slug);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_contents_status_code' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE INDEX idx_cms_contents_status_code ON dbo.cms_contents (status_code);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_contents_content_type_code' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE INDEX idx_cms_contents_content_type_code ON dbo.cms_contents (content_type_code);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_contents_published_at' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE INDEX idx_cms_contents_published_at ON dbo.cms_contents (published_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_contents_parent_content_id' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE INDEX idx_cms_contents_parent_content_id ON dbo.cms_contents (parent_content_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_contents_parent_content_type' AND object_id = OBJECT_ID(N'dbo.cms_contents'))
  CREATE INDEX idx_cms_contents_parent_content_type ON dbo.cms_contents (parent_content_id, content_type_code);
GO

IF OBJECT_ID(N'dbo.cms_content_revisions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_content_revisions (
    id            BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    content_id    BIGINT NOT NULL,
    revision_no   INT NOT NULL,
    title         NVARCHAR(MAX) NULL,
    summary       NVARCHAR(MAX) NULL,
    body          NVARCHAR(MAX) NULL,
    created_by    BIGINT NULL,
    created_at    DATETIME2 NULL CONSTRAINT DF_cms_content_revisions_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cms_content_revisions_content FOREIGN KEY (content_id) REFERENCES dbo.cms_contents(id) ON DELETE CASCADE,
    CONSTRAINT FK_cms_content_revisions_created_by FOREIGN KEY (created_by) REFERENCES dbo.base_users(id),
    CONSTRAINT uq_cms_content_revisions_content_rev UNIQUE (content_id, revision_no)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_revisions_content_id' AND object_id = OBJECT_ID(N'dbo.cms_content_revisions'))
  CREATE INDEX idx_cms_content_revisions_content_id ON dbo.cms_content_revisions (content_id);
GO

IF OBJECT_ID(N'dbo.cms_content_assets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_content_assets (
    id            BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    content_id    BIGINT NOT NULL,
    [file]        VARBINARY(MAX) NOT NULL,
    file_xs       VARBINARY(MAX) NULL,
    file_size     INT NOT NULL,
    file_name     NVARCHAR(1000) NOT NULL,
    file_mime     NVARCHAR(1000) NOT NULL,
    sort_order    INT NOT NULL CONSTRAINT DF_cms_content_assets_sort_order DEFAULT 0,
    sha256        NVARCHAR(1000) NOT NULL,
    created_by    BIGINT NULL,
    created_at    DATETIME2 NOT NULL CONSTRAINT DF_cms_content_assets_created_at DEFAULT SYSUTCDATETIME(),
    updated_by    BIGINT NULL,
    updated_at    DATETIME2 NOT NULL CONSTRAINT DF_cms_content_assets_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cms_content_assets_content FOREIGN KEY (content_id) REFERENCES dbo.cms_contents(id) ON DELETE CASCADE,
    CONSTRAINT FK_cms_content_assets_created_by FOREIGN KEY (created_by) REFERENCES dbo.base_users(id),
    CONSTRAINT FK_cms_content_assets_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.base_users(id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_assets_content_id' AND object_id = OBJECT_ID(N'dbo.cms_content_assets'))
  CREATE INDEX idx_cms_content_assets_content_id ON dbo.cms_content_assets (content_id, sort_order);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_assets_sha256' AND object_id = OBJECT_ID(N'dbo.cms_content_assets'))
  CREATE INDEX idx_cms_content_assets_sha256 ON dbo.cms_content_assets (sha256);
GO

IF OBJECT_ID(N'dbo.cms_content_tags', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_content_tags (
    content_id    BIGINT NOT NULL,
    tag_code      NVARCHAR(1000) NOT NULL,
    CONSTRAINT PK_cms_content_tags PRIMARY KEY (content_id, tag_code),
    CONSTRAINT FK_cms_content_tags_content FOREIGN KEY (content_id) REFERENCES dbo.cms_contents(id) ON DELETE CASCADE,
    CONSTRAINT FK_cms_content_tags_tag FOREIGN KEY (tag_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_tags_tag_code' AND object_id = OBJECT_ID(N'dbo.cms_content_tags'))
  CREATE INDEX idx_cms_content_tags_tag_code ON dbo.cms_content_tags (tag_code);
GO

IF OBJECT_ID(N'dbo.cms_content_relations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_content_relations (
    id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    content_id_a    BIGINT NOT NULL,
    content_id_b    BIGINT NOT NULL,
    note            NVARCHAR(MAX) NULL,
    CONSTRAINT FK_cms_content_relations_a FOREIGN KEY (content_id_a) REFERENCES dbo.cms_contents(id) ON DELETE CASCADE,
    CONSTRAINT FK_cms_content_relations_b FOREIGN KEY (content_id_b) REFERENCES dbo.cms_contents(id),
    CONSTRAINT ck_cms_content_relations_ordered CHECK (content_id_a < content_id_b),
    CONSTRAINT uq_cms_content_relations_pair UNIQUE (content_id_a, content_id_b)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_relations_a' AND object_id = OBJECT_ID(N'dbo.cms_content_relations'))
  CREATE INDEX idx_cms_content_relations_a ON dbo.cms_content_relations (content_id_a);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_cms_content_relations_b' AND object_id = OBJECT_ID(N'dbo.cms_content_relations'))
  CREATE INDEX idx_cms_content_relations_b ON dbo.cms_content_relations (content_id_b);
GO

IF OBJECT_ID(N'dbo.cms_settings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_settings (
    id                          BIGINT NOT NULL CONSTRAINT PK_cms_settings PRIMARY KEY,
    comments_enabled            BIT NOT NULL,
    comments_policy_code        NVARCHAR(1000) NOT NULL,
    comments_body_format_code   NVARCHAR(1000) NOT NULL,
    public_cache_ttl_seconds    INT NOT NULL CONSTRAINT DF_cms_settings_public_cache_ttl_seconds DEFAULT 300,
    updated_by                  BIGINT NULL,
    updated_at                  DATETIME2 NULL CONSTRAINT DF_cms_settings_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_cms_settings_singleton CHECK (id = 1),
    CONSTRAINT FK_cms_settings_comments_policy FOREIGN KEY (comments_policy_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_settings_comments_body_format FOREIGN KEY (comments_body_format_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_cms_settings_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.base_users(id)
  );
END;
GO
