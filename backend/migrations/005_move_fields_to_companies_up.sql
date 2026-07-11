-- 005_move_fields_to_companies_up.sql
-- Moves industry/briefing (and identity via name) from clients to companies,
-- and adds a company-level contact person name + additional phone number.

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS briefing TEXT,
  ADD COLUMN IF NOT EXISTS contact_person_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS additional_phone_number VARCHAR(50);

ALTER TABLE clients
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS industry,
  DROP COLUMN IF EXISTS briefing;

COMMIT;
