-- CRM package Phase 1 schema (PostgreSQL) — v2 (customer = base_users + base_user_profiles + extension)
-- Opt-in only — never run from app bootstrap / controlPlaneSeed.
-- Safe to re-run: IF NOT EXISTS on tables and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS crm_customers (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL UNIQUE REFERENCES base_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  lifecycle_stage_code  TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  source_code           TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  owner_id              BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  note                  TEXT,
  created_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_lifecycle_stage_code
  ON crm_customers (lifecycle_stage_code);

CREATE INDEX IF NOT EXISTS idx_crm_customers_owner_id
  ON crm_customers (owner_id);

CREATE TABLE IF NOT EXISTS crm_customer_tags (
  user_id   BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_code  TEXT NOT NULL REFERENCES base_info(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (user_id, tag_code)
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_tags_tag_code
  ON crm_customer_tags (tag_code);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id                    BIGSERIAL PRIMARY KEY,
  customer_user_id      BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  title                 TEXT NOT NULL,
  stage_code            TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  amount                NUMERIC(18, 2),
  expected_close_date   DATE,
  closed_at             TIMESTAMPTZ,
  owner_id              BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  note                  TEXT,
  created_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_customer_user_id
  ON crm_opportunities (customer_user_id);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage_code
  ON crm_opportunities (stage_code);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_owner_id
  ON crm_opportunities (owner_id);

CREATE TABLE IF NOT EXISTS crm_opportunity_stage_history (
  id                BIGSERIAL PRIMARY KEY,
  opportunity_id    BIGINT NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE ON UPDATE CASCADE,
  from_stage_code   TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  to_stage_code     TEXT NOT NULL REFERENCES base_info(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  changed_by        BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opportunity_stage_history_opportunity_id
  ON crm_opportunity_stage_history (opportunity_id, changed_at);

CREATE TABLE IF NOT EXISTS crm_activities (
  id                    BIGSERIAL PRIMARY KEY,
  customer_user_id      BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  opportunity_id        BIGINT REFERENCES crm_opportunities(id) ON DELETE SET NULL ON UPDATE CASCADE,
  activity_type_code    TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  subject               TEXT NOT NULL,
  note                  TEXT,
  due_at                TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  owner_id              BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_customer_user_id_due_at
  ON crm_activities (customer_user_id, due_at);

CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_id
  ON crm_activities (opportunity_id);

CREATE TABLE IF NOT EXISTS crm_tickets (
  id                  BIGSERIAL PRIMARY KEY,
  customer_user_id    BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  subject             TEXT NOT NULL,
  status_code         TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  priority_code       TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  channel_code        TEXT REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE,
  assigned_to         BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  created_by          BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_by          BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_status_code_assigned_to
  ON crm_tickets (status_code, assigned_to);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_customer_user_id
  ON crm_tickets (customer_user_id);

CREATE TABLE IF NOT EXISTS crm_ticket_messages (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  author_id   BIGINT REFERENCES base_users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_ticket_messages_ticket_id
  ON crm_ticket_messages (ticket_id, created_at);

COMMIT;
