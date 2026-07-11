-- 002_add_auth_down.sql
-- Revert 002_add_auth_up.sql

BEGIN;

DROP INDEX IF EXISTS idx_users_email_lower;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

COMMIT;
