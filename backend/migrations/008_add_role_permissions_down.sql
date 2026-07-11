-- 008_add_role_permissions_down.sql
-- Reverts 008_add_role_permissions_up.sql

BEGIN;

DROP TABLE IF EXISTS role_permissions;

COMMIT;
