-- 005_move_fields_to_companies_down.sql
-- Reverses 005_move_fields_to_companies_up.sql (structural only; column data is not recoverable)

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS briefing TEXT;

ALTER TABLE companies
  DROP COLUMN IF EXISTS industry,
  DROP COLUMN IF EXISTS briefing,
  DROP COLUMN IF EXISTS contact_person_name,
  DROP COLUMN IF EXISTS additional_phone_number;

COMMIT;
