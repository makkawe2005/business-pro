-- 011_remove_user_role_down.sql
-- Reverts 011_remove_user_role_up.sql
-- Note: this can only recreate the 'user' role as a placeholder with its original
-- default permissions (phase1/phase2/phase3) — it cannot know which users were on
-- 'user' before the up-migration reassigned them to 'Customer Relation', so no
-- users are moved back. Lossy, same as other down-migration caveats in this project.

BEGIN;

INSERT INTO roles (name, protected) VALUES ('user', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, page_key)
SELECT (SELECT id FROM roles WHERE name = 'user'), page_key
FROM (VALUES ('phase1'), ('phase2'), ('phase3')) AS defaults(page_key)
ON CONFLICT (role_id, page_key) DO NOTHING;

DO $$
DECLARE default_role_id INTEGER;
BEGIN
    SELECT id INTO default_role_id FROM roles WHERE name = 'user';
    EXECUTE format('ALTER TABLE users ALTER COLUMN role_id SET DEFAULT %L', default_role_id);
END $$;

COMMIT;
