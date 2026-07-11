-- 019_add_calendar_page_up.sql
-- Adds a 'calendar' page_key, granted to every existing role by default so nothing loses
-- access to the new Calendar page until an admin deliberately changes it via the
-- Permissions page. page_key is free-text (role_permissions.page_key is TEXT, not an
-- enum), so no type change is needed here.

BEGIN;

INSERT INTO role_permissions (role_id, page_key)
SELECT id, 'calendar' FROM roles
ON CONFLICT (role_id, page_key) DO NOTHING;

COMMIT;
