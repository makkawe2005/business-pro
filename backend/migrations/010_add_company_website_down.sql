-- 010_add_company_website_down.sql
-- Reverts 010_add_company_website_up.sql

BEGIN;

ALTER TABLE companies DROP COLUMN IF EXISTS website;

COMMIT;
