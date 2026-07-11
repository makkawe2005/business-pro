-- 018_align_users_schema_down.sql
-- Reverts 018_align_users_schema_up.sql
-- Note: lossy, same caveat as other enum/column-collapsing down migrations in this project.
-- Recreates username/full_name/position_id/user_status as empty/best-effort columns — it
-- cannot reconstruct a real username or the original position_id/user_status values, since
-- those were never meaningfully populated before this migration dropped them. `name` is
-- copied into `full_name` as a best-effort backfill; `username` is left NULL (was NOT NULL
-- in 001, so re-adding that constraint here would require synthesizing fake usernames —
-- not attempted).

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
UPDATE users SET full_name = name WHERE full_name IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_status VARCHAR(255);

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS name;
ALTER TABLE users DROP COLUMN IF EXISTS position_name;

COMMIT;
