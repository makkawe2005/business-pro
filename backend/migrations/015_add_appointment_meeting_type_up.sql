-- 015_add_appointment_meeting_type_up.sql
-- Adds a meeting_type column to appointments: Remote or In-Person.
-- Uses VARCHAR + CHECK (not an enum) so values can be added/removed cleanly later.

BEGIN;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) NOT NULL DEFAULT 'Remote'
    CHECK (meeting_type IN ('Remote', 'In-Person'));

COMMIT;
