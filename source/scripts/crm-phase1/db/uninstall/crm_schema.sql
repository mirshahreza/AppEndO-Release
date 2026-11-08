-- CRM package Phase 1 uninstall (PostgreSQL) — v2
-- Drops domain tables only. Base Info CRM root/subtree is removed by the seed rollback helper.

BEGIN;

DROP TABLE IF EXISTS crm_ticket_messages CASCADE;
DROP TABLE IF EXISTS crm_tickets CASCADE;
DROP TABLE IF EXISTS crm_activities CASCADE;
DROP TABLE IF EXISTS crm_opportunity_stage_history CASCADE;
DROP TABLE IF EXISTS crm_opportunities CASCADE;
DROP TABLE IF EXISTS crm_customer_tags CASCADE;
DROP TABLE IF EXISTS crm_customers CASCADE;

COMMIT;
