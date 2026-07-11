-- 010_add_company_website_up.sql
-- Adds a website field to companies, needed by the public client registration form.

BEGIN;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255);

COMMIT;
