-- 015_add_appointment_meeting_type_down.sql
-- Reverts 015_add_appointment_meeting_type_up.sql

BEGIN;

ALTER TABLE appointments
  DROP COLUMN IF EXISTS meeting_type;

COMMIT;
