-- 020_add_appointment_location_link_up.sql
-- Adds location (for In-Person meetings) and meeting_link (for Remote meetings) to appointments.
-- Both optional/nullable — populated depending on the appointment's meeting_type.

BEGIN;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meeting_link VARCHAR(500);

COMMIT;
