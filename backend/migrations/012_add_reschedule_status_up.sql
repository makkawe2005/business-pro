-- 012_add_reschedule_status_up.sql
-- Adds a Reschedule status so Phase 2 can send a client back to Sales for follow-up,
-- distinct from a brand-new Prospect lead.

BEGIN;

ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'Reschedule';

COMMIT;
