-- 007_add_user_roles_down.sql
-- Reverts 007_add_user_roles_up.sql

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
DROP TYPE IF EXISTS user_role;

COMMIT;
