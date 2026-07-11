-- 018_align_users_schema_up.sql
-- Fixes drift between 001_create_schema_up.sql (username/full_name, nullable email) and what
-- the app has actually relied on since early in the project (a single required `name` column,
-- required `email`). Also drops dead, unused columns (position_id, user_status — user_status
-- duplicated the already-used `is_active` boolean) and adds `position_name` (kept for a future
-- feature, currently unused so left nullable).
-- Written to be safe against either starting shape: a fresh database that still has
-- username/full_name (e.g. a new environment applying migrations 001-017 for the first time),
-- or an existing database that already has `name` (drift already happened by hand).

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
    UPDATE users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
    UPDATE users SET name = username WHERE name IS NULL;
  END IF;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
ALTER TABLE users DROP COLUMN IF EXISTS position_id;
ALTER TABLE users DROP COLUMN IF EXISTS user_status;

ALTER TABLE users ADD COLUMN IF NOT EXISTS position_name VARCHAR(255);

ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

COMMIT;
