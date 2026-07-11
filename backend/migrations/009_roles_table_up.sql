-- 009_roles_table_up.sql
-- Replaces the fixed user_role enum with a proper roles table so roles can be
-- added and renamed from the app instead of requiring a schema migration.

BEGIN;

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    protected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, protected) VALUES
    ('admin', true),
    ('user', false),
    ('Customer Relation', false),
    ('Customer Relation Manager', false),
    ('Financial Control', false),
    ('Legal', false),
    ('Project Manager', false),
    ('Business Analyst', false),
    ('Financial Analyst', false),
    ('CEO', false);

-- users.role (enum) -> users.role_id (FK)
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);
UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role::text);
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

DO $$
DECLARE default_role_id INTEGER;
BEGIN
    SELECT id INTO default_role_id FROM roles WHERE name = 'user';
    EXECUTE format('ALTER TABLE users ALTER COLUMN role_id SET DEFAULT %L', default_role_id);
END $$;

ALTER TABLE users DROP COLUMN role;

-- role_permissions.role (enum) -> role_permissions.role_id (FK)
ALTER TABLE role_permissions ADD COLUMN role_id INTEGER REFERENCES roles(id);
UPDATE role_permissions SET role_id = (SELECT id FROM roles WHERE roles.name = role_permissions.role::text);
ALTER TABLE role_permissions ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey;
ALTER TABLE role_permissions DROP COLUMN role;
ALTER TABLE role_permissions ADD PRIMARY KEY (role_id, page_key);

DROP TYPE user_role;

COMMIT;
