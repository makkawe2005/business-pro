-- 006_add_appointments_down.sql
-- Reverts 006_add_appointments_up.sql

BEGIN;

DROP TABLE IF EXISTS appointments;
DROP TYPE IF EXISTS appointment_status;

COMMIT;
