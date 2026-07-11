-- 011_remove_user_role_up.sql
-- One-time cleanup: reassign every user on the 'user' role to 'Customer Relation',
-- then remove the 'user' role entirely. Also repoints the users.role_id default
-- (previously the 'user' role, set in migration 009) at 'Customer Relation' so new
-- self-registrations still get a sane default role.

BEGIN;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'Customer Relation')
WHERE role_id = (SELECT id FROM roles WHERE name = 'user');

DO $$
DECLARE default_role_id INTEGER;
BEGIN
    SELECT id INTO default_role_id FROM roles WHERE name = 'Customer Relation';
    EXECUTE format('ALTER TABLE users ALTER COLUMN role_id SET DEFAULT %L', default_role_id);
END $$;

DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'user');
DELETE FROM roles WHERE name = 'user';

COMMIT;
