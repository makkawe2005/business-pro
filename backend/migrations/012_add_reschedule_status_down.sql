-- 012_add_reschedule_status_down.sql
-- Reverts 012_add_reschedule_status_up.sql
-- Note: Postgres cannot remove a single value from an enum type without rebuilding
-- the type and every column/index that references it. This down migration is a
-- documented no-op — rolling back requires a manual, one-off migration if any rows
-- still use 'Reschedule' at that point (reassign them first, same caveat as the
-- other down migrations in this project that collapse/drop enum-backed data).

BEGIN;

-- Intentionally left blank.

COMMIT;
