-- 002_add_auth_up.sql
-- Adds password storage to users so they can log in.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

COMMIT;
