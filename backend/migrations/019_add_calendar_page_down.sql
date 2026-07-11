-- 019_add_calendar_page_down.sql
-- Reverts 019_add_calendar_page_up.sql

BEGIN;

DELETE FROM role_permissions WHERE page_key = 'calendar';

COMMIT;
