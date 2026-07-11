-- 013_fix_customer_relation_default_permissions_up.sql
-- Migration 011 made 'Customer Relation' the default role for new users (repointing
-- users.role_id's default away from the removed 'user' role), but never granted it
-- any page permissions — new self-registered accounts were completely locked out of
-- the app. Restores the baseline access the old 'user' role used to have.

BEGIN;

INSERT INTO role_permissions (role_id, page_key)
SELECT (SELECT id FROM roles WHERE name = 'Customer Relation'), page_key
FROM (VALUES ('phase1'), ('phase2'), ('phase3')) AS defaults(page_key)
ON CONFLICT (role_id, page_key) DO NOTHING;

COMMIT;
