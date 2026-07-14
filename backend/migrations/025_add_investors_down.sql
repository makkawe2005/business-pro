BEGIN;

DELETE FROM role_permissions WHERE page_key = 'investors';
DROP TABLE IF EXISTS investors;

COMMIT;
