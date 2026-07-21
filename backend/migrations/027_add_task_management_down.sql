-- 027_add_task_management_down.sql
-- Reverts 027_add_task_management_up.sql
-- Note: Postgres cannot remove values from an enum type without rebuilding the type and
-- every column/index that references it, so the phase4/Executing/Completed enum additions
-- are a documented no-op here, same caveat as migrations 012's and 016's down migrations.

BEGIN;

DELETE FROM role_permissions WHERE page_key = 'phase4';
DROP TABLE IF EXISTS task_events;
DROP TABLE IF EXISTS tasks;

COMMIT;
