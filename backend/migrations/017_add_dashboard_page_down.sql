-- 017_add_dashboard_page_down.sql
-- Reverts 017_add_dashboard_page_up.sql

BEGIN;

DELETE FROM role_permissions WHERE page_key = 'dashboard';

COMMIT;
