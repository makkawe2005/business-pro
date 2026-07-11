-- 009_roles_table_down.sql
-- Reverts 009_roles_table_up.sql.
-- Note: this collapses every role back to just 'admin'/'user' — any custom
-- roles in use at rollback time are lossy (their users/permissions become
-- 'user'), since a 2-value enum can't represent arbitrary role names.

BEGIN;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin','user');
    END IF;
END$$;

ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';
UPDATE users SET role = CASE
    WHEN (SELECT name FROM roles WHERE roles.id = users.role_id) = 'admin' THEN 'admin'::user_role
    ELSE 'user'::user_role
END;
ALTER TABLE users DROP COLUMN role_id;

ALTER TABLE role_permissions ADD COLUMN role user_role;
UPDATE role_permissions SET role = CASE
    WHEN (SELECT name FROM roles WHERE roles.id = role_permissions.role_id) = 'admin' THEN 'admin'::user_role
    ELSE 'user'::user_role
END;
ALTER TABLE role_permissions ALTER COLUMN role SET NOT NULL;
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey;
ALTER TABLE role_permissions DROP COLUMN role_id;
-- Collapsing arbitrary roles down to admin/user can produce duplicate
-- (role, page_key) pairs (e.g. two custom roles both granting phase1) —
-- dedupe before restoring the composite primary key.
DELETE FROM role_permissions a USING role_permissions b
    WHERE a.ctid < b.ctid AND a.role = b.role AND a.page_key = b.page_key;
ALTER TABLE role_permissions ADD PRIMARY KEY (role, page_key);

DROP TABLE roles;

COMMIT;
