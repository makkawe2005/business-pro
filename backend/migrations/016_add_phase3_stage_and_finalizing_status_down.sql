-- 016_add_phase3_stage_and_finalizing_status_down.sql
-- Reverts 016_add_phase3_stage_and_finalizing_status_up.sql
-- Note: Postgres cannot remove values from an enum type without rebuilding the type and
-- every column/index that references it. This down migration is a documented no-op —
-- rolling back requires a manual, one-off migration (reassign any 'phase3'/'Finalizing'
-- rows first), same caveat as migration 012's down migration.

BEGIN;

-- Intentionally left blank.

COMMIT;
