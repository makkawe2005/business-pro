-- 028_add_calendar_availability_down.sql
-- Reverts 028_add_calendar_availability_up.sql

BEGIN;

DROP TABLE IF EXISTS calendar_closures;
DROP TABLE IF EXISTS business_hours;

COMMIT;
