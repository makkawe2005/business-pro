-- 013_fix_customer_relation_default_permissions_down.sql
-- Reverts 013_fix_customer_relation_default_permissions_up.sql

BEGIN;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Customer Relation')
  AND page_key IN ('phase1', 'phase2', 'phase3');

COMMIT;
