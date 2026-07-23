-- 029_add_closure_date_range_up.sql
-- Lets a single calendar_closures row span a range of days (e.g. a week-long holiday)
-- instead of requiring one row per day. Nullable and additive: existing single-day rows
-- (end_date IS NULL) keep working — every read treats COALESCE(end_date, closure_date)
-- as the effective end of the range.

BEGIN;

ALTER TABLE calendar_closures ADD COLUMN IF NOT EXISTS end_date DATE;

COMMIT;
