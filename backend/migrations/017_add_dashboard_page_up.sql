-- 017_add_dashboard_page_up.sql
-- Grants the admin role access to the new 'dashboard' page_key (a pipeline-wide summary view).
-- page_key is free-text (role_permissions.page_key is TEXT, not an enum), so no type change is
-- needed here -- other roles can be granted 'dashboard' afterward via the Permissions page.

BEGIN;

INSERT INTO role_permissions (role_id, page_key)
SELECT id, 'dashboard' FROM roles WHERE name = 'admin'
ON CONFLICT (role_id, page_key) DO NOTHING;

COMMIT;
