-- 030_add_my_tasks_page_down.sql
-- Reverts 030_add_my_tasks_page_up.sql

BEGIN;

DELETE FROM role_permissions WHERE page_key = 'my_tasks';

COMMIT;
