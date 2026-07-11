-- 020_add_appointment_location_link_down.sql

BEGIN;

ALTER TABLE appointments DROP COLUMN IF EXISTS location;
ALTER TABLE appointments DROP COLUMN IF EXISTS meeting_link;

COMMIT;
