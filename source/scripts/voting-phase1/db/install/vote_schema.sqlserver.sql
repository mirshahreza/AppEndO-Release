-- Voting package Phase 1 schema (SQL Server)
-- Opt-in only — never from app bootstrap.

IF OBJECT_ID(N'dbo.vote_votings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_votings (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    title                 NVARCHAR(500) NOT NULL,
    status_code           NVARCHAR(1000) NULL,
    starts_at             DATETIME2 NULL,
    ends_at               DATETIME2 NULL,
    geo_root_id           BIGINT NULL,
    operator_note         NVARCHAR(MAX) NULL,
    created_by            BIGINT NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_votings_created_at DEFAULT SYSUTCDATETIME(),
    updated_by            BIGINT NULL,
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_votings_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_votings_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_vote_votings_created_by FOREIGN KEY (created_by) REFERENCES dbo.base_users(id),
    CONSTRAINT FK_vote_votings_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.base_users(id)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_ballots', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_ballots (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    ballot_type_code      NVARCHAR(1000) NULL,
    title                 NVARCHAR(500) NOT NULL,
    status_code           NVARCHAR(1000) NULL,
    selection_mode        NVARCHAR(20) NOT NULL CONSTRAINT DF_vote_ballots_selection_mode DEFAULT N'single',
    max_selections        INT NULL,
    sort_order            INT NOT NULL CONSTRAINT DF_vote_ballots_sort_order DEFAULT 0,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_ballots_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_ballots_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_ballots_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE CASCADE,
    CONSTRAINT FK_vote_ballots_type FOREIGN KEY (ballot_type_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_vote_ballots_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_candidates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_candidates (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    ballot_id             BIGINT NULL,
    display_name          NVARCHAR(500) NOT NULL,
    sort_order            INT NOT NULL CONSTRAINT DF_vote_candidates_sort_order DEFAULT 0,
    hwy_member_id         BIGINT NULL,
    hwy_nakheb_id         BIGINT NULL,
    geo_scope_id          BIGINT NULL,
    status_code           NVARCHAR(1000) NULL,
    list_scope_legacy     NVARCHAR(200) NULL,
    operator_note         NVARCHAR(MAX) NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_candidates_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_candidates_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_candidates_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE CASCADE,
    CONSTRAINT FK_vote_candidates_ballot FOREIGN KEY (ballot_id) REFERENCES dbo.vote_ballots(id),
    CONSTRAINT FK_vote_candidates_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_vote_candidates_voting' AND object_id = OBJECT_ID(N'dbo.vote_candidates'))
  CREATE INDEX idx_vote_candidates_voting ON dbo.vote_candidates (voting_id, status_code);
GO

IF OBJECT_ID(N'dbo.vote_voter_registrations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_voter_registrations (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    hwy_member_id         BIGINT NULL,
    hwy_nakheb_id         BIGINT NULL,
    invited_by_member_id  BIGINT NULL,
    status_code           NVARCHAR(1000) NULL,
    tracking_code         NVARCHAR(100) NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_voter_reg_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_voter_reg_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_voter_reg_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE CASCADE,
    CONSTRAINT FK_vote_voter_reg_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_polling_stations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_polling_stations (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    title                 NVARCHAR(500) NOT NULL,
    geo_node_id           BIGINT NULL,
    legacy_car_id         INT NULL,
    is_active             BIT NOT NULL CONSTRAINT DF_vote_polling_stations_active DEFAULT 1,
    operator_note         NVARCHAR(MAX) NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_polling_stations_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_polling_stations_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_polling_stations_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_observers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_observers (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    station_id            BIGINT NULL,
    hwy_member_id         BIGINT NULL,
    role_code             NVARCHAR(1000) NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_observers_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_observers_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE CASCADE,
    CONSTRAINT FK_vote_observers_station FOREIGN KEY (station_id) REFERENCES dbo.vote_polling_stations(id),
    CONSTRAINT FK_vote_observers_role FOREIGN KEY (role_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_cast_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_cast_events (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NOT NULL,
    ballot_id             BIGINT NOT NULL,
    candidate_id          BIGINT NULL,
    voter_registration_id BIGINT NULL,
    cast_channel_code     NVARCHAR(1000) NULL,
    idempotency_key       NVARCHAR(200) NOT NULL,
    payload_json          NVARCHAR(MAX) NULL,
    created_by            BIGINT NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_cast_events_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_cast_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id),
    CONSTRAINT FK_vote_cast_ballot FOREIGN KEY (ballot_id) REFERENCES dbo.vote_ballots(id),
    CONSTRAINT FK_vote_cast_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.vote_candidates(id),
    CONSTRAINT FK_vote_cast_voter FOREIGN KEY (voter_registration_id) REFERENCES dbo.vote_voter_registrations(id),
    CONSTRAINT FK_vote_cast_channel FOREIGN KEY (cast_channel_code) REFERENCES dbo.base_info(id),
    CONSTRAINT FK_vote_cast_created_by FOREIGN KEY (created_by) REFERENCES dbo.base_users(id),
    CONSTRAINT uq_vote_cast_idempotency UNIQUE (voting_id, idempotency_key)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_poll_questions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_poll_questions (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voting_id           BIGINT NULL,
    title                 NVARCHAR(1000) NOT NULL,
    status_code           NVARCHAR(1000) NULL,
    publish_level_code    NVARCHAR(1000) NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_poll_questions_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_poll_questions_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_poll_questions_election FOREIGN KEY (voting_id) REFERENCES dbo.vote_votings(id) ON DELETE SET NULL,
    CONSTRAINT FK_vote_poll_questions_status FOREIGN KEY (status_code) REFERENCES dbo.base_info(id)
  );
END;
GO

IF OBJECT_ID(N'dbo.vote_poll_answers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.vote_poll_answers (
    id                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    question_id           BIGINT NOT NULL,
    answer_code           NVARCHAR(1000) NULL,
    grade_value           INT NULL,
    voter_member_id       BIGINT NULL,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_vote_poll_answers_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_vote_poll_answers_question FOREIGN KEY (question_id) REFERENCES dbo.vote_poll_questions(id) ON DELETE CASCADE,
    CONSTRAINT FK_vote_poll_answers_code FOREIGN KEY (answer_code) REFERENCES dbo.base_info(id)
  );
END;
GO
