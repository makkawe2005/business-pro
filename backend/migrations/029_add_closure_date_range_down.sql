-- 029_add_closure_date_range_down.sql
-- Reverts 029_add_closure_date_range_up.sql

BEGIN;

ALTER TABLE calendar_closures DROP COLUMN IF EXISTS end_date;

COMMIT;
